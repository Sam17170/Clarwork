-- Table des prospects/leads générés par l'outil
create table prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),

  nom_entreprise text,
  secteur text,
  ville text,
  formule text, -- 'essentiel' ou 'signature'

  email text,
  telephone text,

  statut text default 'generation_seule',
  -- valeurs possibles : generation_seule / email_fourni / contact_direct / contacte / converti

  source text default 'generateur_ia',
  notes text
);

-- Index pour retrouver rapidement les leads à traiter
create index idx_prospects_statut on prospects (statut);
create index idx_prospects_created_at on prospects (created_at desc);

-- Table de suivi des générations par IP, pour le rate-limiting
create table generation_logs (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamp with time zone default now()
);

-- Index essentiel : la requête de rate-limiting filtre par IP + date
create index idx_generation_logs_ip_date on generation_logs (ip, created_at desc);

-- Optionnel mais recommandé : purge automatique des logs de plus de 7 jours,
-- à exécuter via un cron Supabase (Database > Cron Jobs) une fois par jour :
-- delete from generation_logs where created_at < now() - interval '7 days';
