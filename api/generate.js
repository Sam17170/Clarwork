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
en un seul fichier HTML autonome (CSS inline dans une balise <style>, pas de
dépendances externes sauf Google Fonts).

## Informations de l'entreprise
- Nom : ${nomEntreprise}
- Secteur d'activité : ${secteur}
- Ville : ${ville}
- Palette de couleurs à utiliser (respecte STRICTEMENT ces couleurs) : ${paletteHex}
- Nom de la palette : ${paletteNom}
- Ton de communication : ${ton}
- Particularité de l'entreprise : ${particularite || "aucune précisée, reste générique mais crédible"}
- Photos disponibles (à intégrer en <img src="...">) : ${photosUrls.join(', ') || "aucune"}
- Formule commandée : ${formule}

## Règles de design (impératives)
1. Choisis une paire de polices Google Fonts adaptée au secteur et au ton.
2. Crée UN élément signature propre au secteur (pas une liste générique de 3 services avec icônes).
3. Site 100% responsive avec menu mobile hamburger fonctionnel (JS natif, sous 768px).
4. Utilise les photos fournies dans {{photosUrls}} en <img>, ne jamais laisser de zone vide.
5. Le texte doit refléter le ton demandé et intégrer la particularité comme élément central.
6. Aucun prix affiché. Chaque section se termine par un bouton "Demander un devis".
7. Aucun faux avis, fausse statistique ou fausse étude de cas.

## Structure selon la formule
### Si formule = "essentiel" : site one-page en 4 sections (header simple, hero, services 3-4 éléments, contact).
### Si formule = "signature" : site one-page enrichi en 7 sections (header + nav complète, hero, galerie photo, services détaillés, élément signature développé, zones d'intervention si pertinent, contact avec vrai formulaire).

## Format de sortie
Réponds UNIQUEMENT avec le code HTML complet, sans texte avant/après, sans balises markdown. Commence par <!DOCTYPE html>.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const {
      nomEntreprise, secteur, ville, paletteNom, paletteHex,
      ton, particularite, formule, photosUrls = [],
    } = req.body;

    // 1. Validation minimale
    if (!nomEntreprise || !secteur || !ville || !formule) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    // 1bis. Rate-limiting par IP — bloque avant tout appel payant à Claude
    const clientIp = getClientIp(req);
    const withinLimit = await checkRateLimit(clientIp);
    if (!withinLimit) {
      return res.status(429).json({
        error: `Vous avez atteint la limite de ${MAX_GENERATIONS_PAR_JOUR} générations gratuites aujourd'hui. Réessayez demain, ou contactez-nous directement.`,
      });
    }

    // 2. Sanitize de tous les champs texte libre (protection contre l'injection de prompt)
    const clean = {
      nomEntreprise: sanitizeInput(nomEntreprise, 100),
      secteur: sanitizeInput(secteur, 100),
      ville: sanitizeInput(ville, 100),
      paletteNom: sanitizeInput(paletteNom, 50),
      paletteHex: sanitizeInput(paletteHex, 200),
      ton: sanitizeInput(ton, 50),
      particularite: sanitizeInput(particularite, 300),
      formule: formule === 'signature' ? 'signature' : 'essentiel',
    };

    // 3. Photos : celles du client en priorité, sinon recherche Pexels
    let finalPhotos = Array.isArray(photosUrls) ? photosUrls.slice(0, 6) : [];
    if (finalPhotos.length === 0) {
      finalPhotos = await fetchPexelsPhotos(clean.secteur, clean.formule === 'signature' ? 4 : 1);
    }

    // 4. Construction du prompt et appel à l'API Claude
    const systemPrompt = buildSystemPrompt({ ...clean, photosUrls: finalPhotos });
    const maxTokens = clean.formule === 'signature' ? 6000 : 3000;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Génère le site maintenant.' }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('Erreur API Claude:', errText);
      return res.status(502).json({ error: 'Erreur lors de la génération' });
    }

    const claudeData = await claudeRes.json();
    let html = claudeData.content?.[0]?.text || '';

    // Sécurité : si le modèle a ajouté du texte parasite avant le HTML, on tronque
    const docTypeIndex = html.indexOf('<!DOCTYPE html>');
    if (docTypeIndex > 0) html = html.slice(docTypeIndex);

    // 5. Sauvegarde du lead partiel (avant email) — permet la relance même en cas d'abandon
    const { data: lead, error: dbError } = await supabase
      .from('prospects')
      .insert({
        nom_entreprise: clean.nomEntreprise,
        secteur: clean.secteur,
        ville: clean.ville,
        formule,
        statut: 'generation_seule',
        source: 'generateur_ia',
      })
      .select()
      .single();

    if (dbError) console.error('Erreur Supabase (non bloquante):', dbError);

    // Log de la génération pour le rate-limiting (après coup, une fois le succès confirmé)
    await logGeneration(clientIp);

    return res.status(200).json({ html, leadId: lead?.id || null });
  } catch (err) {
    console.error('Erreur inattendue:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
