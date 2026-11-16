-- VerifyCheck — migration incrémentale : dépenses (comptabilité) 2026-11-16
-- À exécuter manuellement dans l'éditeur SQL Supabase APRÈS validation humaine.
--
-- Service comptabilité : les RECETTES proviennent des règlements de frais
-- (`payments`, migration 2026-11-16_frais_scolarite.sql) ; les DÉPENSES sont
-- saisies ici. Le solde est DÉRIVÉ (src/lib/comptabilite.ts), jamais stocké.
--
-- Minimisation : libellé + montant GNF + date + catégorie. Aucun justificatif
-- numérisé, aucune donnée bancaire. RLS admin-only, comme le reste du schéma.

create table expenses (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  categorie text not null
    check (categorie in (
      'salaires', 'fournitures', 'entretien', 'transport', 'energie', 'loyer', 'autre'
    )),
  montant_gnf integer not null check (montant_gnf > 0),
  date_depense date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index expenses_date_idx on expenses (date_depense);
create index expenses_categorie_idx on expenses (categorie);

alter table expenses enable row level security;

grant select, insert, update, delete on expenses to authenticated;
revoke all on expenses from anon;

create policy "admin full access expenses" on expenses
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
