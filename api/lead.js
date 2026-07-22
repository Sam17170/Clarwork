// api/lead.js
// Appelée quand le visiteur laisse email + téléphone après avoir vu son aperçu.
// Met à jour la ligne déjà créée par generate.js (statut "generation_seule")
// plutôt que d'en créer une nouvelle.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { leadId, email, telephone } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  try {
    let query = supabase
      .from('prospects')
      .update({
        email,
        telephone: telephone || null,
        statut: 'email_fourni',
      });

    if (leadId) {
      query = query.eq('id', leadId);
    } else {
      // Cas de secours : pas de leadId (ex. session expirée) → nouvelle ligne
      const { error } = await supabase.from('prospects').insert({
        email,
        telephone: telephone || null,
        statut: 'email_fourni',
        source: 'generateur_ia',
      });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    const { error } = await query;
    if (error) throw error;

    // TODO : déclencher ici une notification (email/Slack) pour recontacter à chaud

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erreur lead.js:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
