// api/generate.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

const MAX_GENERATIONS_PAR_JOUR = 20;

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
    return true;
  }
  return (count || 0) < MAX_GENERATIONS_PAR_JOUR;
}

async function logGeneration(ip) {
  const { error } = await supabase.from('generation_logs').insert({ ip });
  if (error) console.error('Erreur log génération (non bloquante):', error);
}

function sanitizeInput(str, maxLength) {
  if (maxLength === undefined) maxLength = 200;
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

async function fetchPexelsPhotos(secteur, count) {
  if (count === undefined) count = 4;
  const keyword = SECTEUR_TO_KEYWORD[secteur.toLowerCase()] || secteur;
  const url = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(keyword) + '&per_page=' + count + '&orientation=landscape';
  const res = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.photos || []).map(function (p) { return p.src.large; });
}

function buildSystemPrompt(params) {
  const nomEntreprise = params.nomEntreprise;
  const secteur = params.secteur;
  const ville = params.ville;
  const paletteNom = params.paletteNom;
  const paletteHex = params.paletteHex;
  const ton = params.ton;
  const particularite = params.particularite;
  const photosUrls = params.photosUrls;
  const formule = params.formule;

  const particulariteTexte = particularite ? particularite : 'aucune précisée, reste générique mais crédible';
  const photosTexte = photosUrls.length > 0 ? photosUrls.join(', ') : 'aucune';

  let prompt = 'Tu es un générateur expert de sites vitrine HTML/CSS pour des TPE et PME françaises. ';
  prompt += 'Tu reçois les informations d une entreprise et tu génères un aperçu de site vitrine ';
  prompt += 'en un seul fichier HTML autonome (CSS inline dans une balise style, pas de dépendances externes sauf Google Fonts).\n\n';
  prompt += 'Informations de l entreprise:\n';
  prompt += '- Nom: ' + nomEntreprise + '\n';
  prompt += '- Secteur d activite: ' + secteur + '\n';
  prompt += '- Ville: ' + ville + '\n';
  prompt += '- Palette de couleurs a utiliser (respecte STRICTEMENT ces couleurs): ' + paletteHex + '\n';
  prompt += '- Nom de la palette: ' + paletteNom + '\n';
  prompt += '- Ton de communication: ' + ton + '\n';
  prompt += '- Particularite de l entreprise: ' + particulariteTexte + '\n';
  prompt += '- Photos disponibles (a integrer en balise img): ' + photosTexte + '\n';
  prompt += '- Formule commandee: ' + formule + '\n\n';

  prompt += 'Avant d ecrire le moindre code, raisonne en interne (sans l ecrire dans ta reponse) sur ces 3 points :\n';
  prompt += '1. A quelle famille appartient ce secteur : artisanat/technique (plombier, electricien, macon), commerce/restauration (boulangerie, restaurant, epicerie), sante/bien-etre (coiffeur, institut, kine), hebergement/loisirs (camping, hotel, gite), ou service professionnel (comptable, avocat, consultant) ?\n';
  prompt += '2. Quel est le bon verbe d action pour cette famille : Demander un devis pour l artisanat/technique et les services professionnels, Reserver une table pour la restauration, Prendre rendez-vous pour la sante/bien-etre, Reserver pour l hebergement.\n';
  prompt += '3. Quels intitules de section ont vraiment du sens pour ce metier precis, plutot que des intitules generiques. Exemples: un restaurant a une carte, pas une liste de services. Un plombier a des prestations, pas une carte. Un institut de beaute a des soins, pas un menu.\n\n';

  prompt += 'Regles de design (imperatives):\n';
  prompt += '1. Choisis une paire de polices Google Fonts adaptee au secteur et au ton.\n';
  prompt += '2. Cree UN element signature propre au secteur reel indique, pense-le comme si tu concevais ce site pour la premiere fois, pas un gabarit recycle. Refuse-toi a reutiliser mecaniquement le meme type d element (frise horaire, ticket de caisse, badge circulaire) d une generation a l autre : choisis celui qui raconte vraiment quelque chose de specifique a ce metier et cette particularite.\n';
  prompt += '3. Site 100% responsive avec menu mobile hamburger fonctionnel en JS natif, sous 768px.\n';
  prompt += '4. Utilise les photos fournies en balise img, ne jamais laisser de zone vide.\n';
  prompt += '5. Le texte doit refleter le ton demande et integrer la particularite comme element central, pas comme detail secondaire noye dans un paragraphe.\n';
  prompt += '6. Aucun prix affiche. Utilise le verbe d action identifie a l etape de raisonnement (devis, reservation, rendez-vous...), jamais Demander un devis par defaut si ca n a pas de sens pour ce secteur.\n';
  prompt += '7. Aucun faux avis, fausse statistique ou fausse etude de cas.\n';
  prompt += '8. Verifie la coherence globale avant de conclure : les intitules de section, le vocabulaire employe et le call-to-action doivent tous appartenir au meme univers metier, sans terme qui jure ou qui vient d un autre secteur.\n\n';

  prompt += 'Structure selon la formule:\n';
  prompt += 'Si formule est essentiel: site one-page en 4 sections (header simple, hero, services 3-4 elements, contact).\n';
  prompt += 'Si formule est signature: site one-page enrichi en 7 sections (header et nav complete, hero, galerie photo, services detailles, element signature developpe, zones d intervention si pertinent, contact avec vrai formulaire).\n\n';
  prompt += 'Format de sortie: Reponds UNIQUEMENT avec le code HTML complet, sans texte avant ou apres, sans balises markdown. Commence par la balise DOCTYPE html.';

  return prompt;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const body = req.body;
    const nomEntreprise = body.nomEntreprise;
    const secteur = body.secteur;
    const ville = body.ville;
    const paletteNom = body.paletteNom;
    const paletteHex = body.paletteHex;
    const ton = body.ton;
    const particularite = body.particularite;
    const formule = body.formule;
    const photosUrls = body.photosUrls || [];

    if (!nomEntreprise || !secteur || !ville || !formule) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    const clientIp = getClientIp(req);
    const withinLimit = await checkRateLimit(clientIp);
    if (!withinLimit) {
      return res.status(429).json({
        error: 'Vous avez atteint la limite de ' + MAX_GENERATIONS_PAR_JOUR + ' générations gratuites aujourd hui. Réessayez demain, ou contactez-nous directement.',
      });
    }

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

    let finalPhotos = Array.isArray(photosUrls) ? photosUrls.slice(0, 6) : [];
    if (finalPhotos.length === 0) {
      finalPhotos = await fetchPexelsPhotos(clean.secteur, clean.formule === 'signature' ? 4 : 1);
    }

    const systemPrompt = buildSystemPrompt({
      nomEntreprise: clean.nomEntreprise,
      secteur: clean.secteur,
      ville: clean.ville,
      paletteNom: clean.paletteNom,
      paletteHex: clean.paletteHex,
      ton: clean.ton,
      particularite: clean.particularite,
      photosUrls: finalPhotos,
      formule: clean.formule,
    });

    const maxTokens = clean.formule === 'signature' ? 16000 : 8000;

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

    let html = '';
    if (claudeData.content && Array.isArray(claudeData.content)) {
      const textBlock = claudeData.content.find(function (block) {
        return block.type === 'text';
      });
      if (textBlock) html = textBlock.text;
    }

    const docTypeIndex = html.indexOf('<!DOCTYPE html>');
    if (docTypeIndex > 0) html = html.slice(docTypeIndex);

    let lead = null;
    try {
      const insertResult = await supabase
        .from('prospects')
        .insert({
          nom_entreprise: clean.nomEntreprise,
          secteur: clean.secteur,
          ville: clean.ville,
          formule: formule,
          statut: 'generation_seule',
          source: 'generateur_ia',
        })
        .select()
        .single();
      lead = insertResult.data;
      if (insertResult.error) console.error('Erreur Supabase (non bloquante):', insertResult.error);
    } catch (dbErr) {
      console.error('Erreur Supabase (non bloquante):', dbErr);
    }

    await logGeneration(clientIp);

    return res.status(200).json({ html: html, leadId: lead ? lead.id : null });
  } catch (err) {
    console.error('Erreur inattendue:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
