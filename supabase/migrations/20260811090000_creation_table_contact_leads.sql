-- Demandes de contact du site FRAGMENT.
--
-- Le site est un export statique : il n'a aucun serveur à lui. Toute écriture
-- passe par la fonction Edge `contact`, qui utilise la clé `service_role` et
-- contourne donc la RLS. Le navigateur, lui, n'atteint jamais cette table.

create table if not exists public.contact_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Champs réellement présents dans le formulaire.
  first_name    text        not null,
  email         text        not null,
  message       text,
  variant_id    text        not null,
  configuration text,
  source        text,
  consent       boolean     not null default false,

  -- Suivi côté atelier.
  status        text        not null default 'nouveau',

  -- Traçabilité de la notification. Une demande reste enregistrée même si
  -- l'envoi de l'e-mail échoue : on ne perd jamais un contact pour cette raison.
  email_sent_at timestamptz,
  email_error   text,

  -- Limitation de fréquence. L'IP n'est JAMAIS stockée en clair : seul son
  -- condensé salé l'est, ce qui suffit à compter sans conserver de donnée
  -- identifiante au-delà de ce que le visiteur a lui-même écrit.
  ip_hash       text,
  user_agent    text,

  constraint contact_leads_first_name_len   check (char_length(first_name) between 2 and 80),
  constraint contact_leads_email_len        check (char_length(email) between 3 and 160),
  constraint contact_leads_message_len      check (message is null or char_length(message) <= 1000),
  constraint contact_leads_variant_len      check (char_length(variant_id) <= 64),
  constraint contact_leads_status_connu     check (status in ('nouveau', 'en_cours', 'traite', 'archive'))
);

comment on table public.contact_leads is
  'Demandes envoyées depuis le formulaire de contact du site FRAGMENT. Écriture exclusivement via la fonction Edge « contact ».';

-- Lecture par l'atelier : les demandes les plus récentes d'abord.
create index if not exists contact_leads_created_at_idx
  on public.contact_leads (created_at desc);

-- Sert uniquement au comptage de la limitation de fréquence dans la fonction Edge.
create index if not exists contact_leads_ip_hash_created_at_idx
  on public.contact_leads (ip_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- Sécurité
-- ---------------------------------------------------------------------------
-- RLS activée SANS AUCUNE POLICY : c'est volontaire, et c'est la configuration
-- la plus fermée qui soit. Sans policy, tout rôle soumis à la RLS (`anon`,
-- `authenticated`) se voit refuser lecture comme écriture. Seul `service_role`,
-- qui contourne la RLS par conception, peut insérer — et il ne vit que dans les
-- secrets de la fonction Edge, jamais dans le navigateur.
alter table public.contact_leads enable row level security;

-- Ceinture et bretelles : on retire aussi les privilèges de table hérités.
revoke all on table public.contact_leads from anon, authenticated;
