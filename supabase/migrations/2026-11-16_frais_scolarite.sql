-- VerifyCheck — migration incrémentale : frais de scolarité (2026-11-16)
-- À exécuter manuellement dans l'éditeur SQL Supabase APRÈS validation humaine.
--
-- Principe : minimisation des données élèves. On ne stocke que des MONTANTS
-- (GNF, entiers) et des DATES — aucune donnée de paiement sensible (pas de
-- numéro de carte, pas de coordonnées bancaires, pas de pièce d'identité).
-- RLS admin-only, comme le reste du schéma.
--
-- Modèle :
--   fees     : un frais ATTENDU pour une CLASSE sur une période.
--   payments : un RÈGLEMENT REÇU pour un ÉLÈVE (rattaché à un frais).
-- Le solde et le statut sont DÉRIVÉS (jamais stockés) : src/lib/scolarite.ts.

create table fees (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references classes(id) on delete cascade,
  libelle text not null,                       -- ex. « Scolarité T1 »
  annee_scolaire text not null,                -- ex. « 2026-2027 »
  montant_gnf integer not null check (montant_gnf > 0),
  echeance date,                               -- date limite indicative (optionnelle)
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  fee_id uuid not null references fees(id) on delete cascade,
  montant_gnf integer not null check (montant_gnf > 0),
  recu_le date not null default current_date,  -- date du règlement (pas d'heure)
  note text,                                   -- référence libre (reçu papier…)
  created_at timestamptz not null default now()
);

create index fees_classe_idx on fees (classe_id);
create index payments_student_idx on payments (student_id);
create index payments_fee_idx on payments (fee_id);

-- RLS activé
alter table fees enable row level security;
alter table payments enable row level security;

-- Privilèges : seuls les rôles authentifiés (session admin). Aucun droit anon.
grant select, insert, update, delete on fees to authenticated;
grant select, insert, update, delete on payments to authenticated;
revoke all on fees from anon;
revoke all on payments from anon;

-- Policies admin-only (app_metadata.role = 'admin', jamais user_metadata).
create policy "admin full access fees" on fees
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin full access payments" on payments
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
