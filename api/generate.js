// api/generate.js
// Fonction serverless Vercel — appelée par le formulaire React en POST.
// Étapes : 1) sanitize des inputs  2) recherche photo Pexels si besoin
// 3) construction du prompt système  4) appel API Claude  5) sauvegarde
// du lead partiel dans Supabase (avant même que l'email soit fourni).

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // clé serveur, jamais exposée au client
);

// Nombre maximum de générations gratuites autorisées par IP sur 24h.
// Ajuste ce chiffre selon ton budget (chaque génération coûte ~0,03-0,06$ avec Sonnet 5).
const MAX_GENERATIONS_PAR_JOUR = 3;

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

async function checkRateLimit(ip) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('generation_logs')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since);

  if (error) {
    console.error('Erreur vérification rate-limit (on laisse passer):', error);
    return true; // en cas d'erreur technique, on ne bloque pas l'utilisateur légitime
  }
  return (count || 0) < MAX_GENERATIONS_PAR_JOUR;
}

async function logGeneration(ip) {
  const { error } = await supabase.from('generation_logs').insert({ ip });
  if (error) console.error('Erreur log génération (non bloquante):', error);
}

// Petit dictionnaire de traduction secteur -> mot-clé anglais pour Pexels.
// Complète cette liste au fil des secteurs que tu rencontres le plus souvent.
const SECTEUR_TO_KEYWORD = {
  'boulangerie': 'bakery bread',
  'boulangerie artisanale': 'artisan bakery',
  'plombier': 'plumber pipe repair',
  'plombier-chauffagiste': 'plumber heating repair',
  'paysagiste': 'gardener landscaping',
  'restaurant': 'restaurant chef kitchen',
  'coiffeur': 'hair salon stylist',
  'électricien': 'electrician wiring',
  'menuisier': 'carpenter woodworking',
  'garage automobile': 'car mechanic garage',
  'institut de beauté': 'beauty salon spa',
  'fleuriste': 'florist flower shop',
};

function sanitizeInput(str, maxLength = 200) {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, '') // retire toute balise HTML/JS injectée
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

async function fetchPexelsPhotos(secteur, count = 4) {
  const keyword = SECTEUR_TO_KEYWORD[secteur.toLowerCase()] || secteur;
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=${count}&orientation=landscape`,
    { headers: { Authorization: process.env.PEXELS_API_KEY } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.photos || []).map((p) => p.src.large);
}

function buildSystemPrompt({
  nomEntreprise, secteur, ville, paletteNom, paletteHex,
  ton, particularite, photosUrls, formule,
}) {
  return `Tu es un générateur expert de sites vitrine HTML/CSS pour des TPE et PME françaises.
Tu reçois les informations d'une entreprise et tu génères un aperçu de site vitrine
en un seul fichier HTML autonome (CSS inline dans une balise
