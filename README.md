# Vitrine Express — Générateur d'aperçu de site IA

## Ce que fait ce projet

Un formulaire (React) où un prospect entre les infos de son entreprise, clique sur une
palette de couleurs, choisit un ton et une formule (Essentiel/Signature). Le serveur
(Vercel) récupère des photos réelles du secteur via Pexels si le client n'en fournit
pas, construit un prompt et appelle l'API Claude (Sonnet 5) pour générer un site
vitrine complet en HTML/CSS, affiché instantanément dans un `<iframe>`. Le lead est
enregistré dans Supabase dès la génération (avant même l'email), pour pouvoir
relancer les visiteurs qui abandonnent en cours de route.

## Structure des fichiers

```
api/
  generate.js   → génère le site (Pexels + Claude + sauvegarde lead partiel)
  lead.js       → capture email/téléphone, met à jour le lead existant
src/
  components/
    GeneratorForm.jsx → le formulaire complet + affichage du résultat
supabase-schema.sql   → à exécuter une fois dans l'éditeur SQL Supabase
.env.example          → variables à renseigner dans Vercel
```

## Développement local

```
npm install
npm run dev          # lance le frontend Vite (http://localhost:5173)
```

Pour tester les fonctions `/api` en local, installe la CLI Vercel et lance-la
en parallèle dans un second terminal :
```
npm install -g vercel
vercel dev            # démarre les fonctions api/ sur http://localhost:3000
```

## Pousser ce projet vers ton repo GitHub (Clarwork)

Depuis le dossier du projet :
```
git init
git add .
git commit -m "Premier commit — générateur Vitrine Express"
git branch -M main
git remote add origin https://github.com/Sam17170/Clarwork.git
git push -u origin main
```

## Installation (clés API et base de données)

1. **Crée un projet Supabase** (gratuit) sur supabase.com, récupère `SUPABASE_URL`
   et la clé `service_role` (Réglages > API).
2. **Exécute `supabase-schema.sql`** dans l'éditeur SQL de ton projet Supabase pour
   créer la table `prospects`.
3. **Crée un compte Pexels** sur pexels.com/api, récupère ta clé gratuite.
4. **Récupère ta clé API Anthropic** sur console.anthropic.com.
5. Dans ton projet Vercel, va dans **Settings > Environment Variables** et ajoute
   les 4 clés listées dans `.env.example`.
6. Installe les dépendances :
   ```
   npm install @supabase/supabase-js
   ```
7. Déploie sur Vercel (`vercel deploy` ou connecte ton repo GitHub).

## Points d'attention avant mise en production

- **Rate limiting** : ✅ codé — chaque IP est limitée à 3 générations gratuites
  par 24h (constante `MAX_GENERATIONS_PAR_JOUR` en haut de `api/generate.js`,
  ajustable). Un job de purge des logs de plus de 7 jours est fourni en
  commentaire dans `supabase-schema.sql` (à activer via Database > Cron Jobs
  dans Supabase).
- **Notification de nouveau lead** : le `TODO` dans `api/lead.js` est à compléter
  avec un envoi d'email (ex. Resend, SendGrid) ou un webhook Slack, pour être
  prévenu immédiatement et recontacter le prospect à chaud.
- **Upload de photos client** : ce code part du principe que `photosUrls` est vide
  (donc Pexels prend le relai). L'upload réel de photos par le visiteur (vers
  Supabase Storage) reste à ajouter dans le formulaire si tu veux cette option.
- **Coût par génération** : environ 0,03-0,06$ avec Sonnet 5 selon la formule
  (Essentiel vs Signature) et le tarif en vigueur.
