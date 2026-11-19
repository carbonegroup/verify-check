-- VerifyCheck — MVP schema (v2, 2026-11)
-- À exécuter manuellement dans l'éditeur SQL Supabase après validation humaine.
-- Principe : minimisation des données élèves (pas de photo, pas d'email),
-- RLS stricte réservée aux admins, fuseau scolaire Africa/Conakry.
--
-- v2 : niveaux (cycles) + option + département universitaire sur `classes`
--      (système guinéen). Voir supabase/migrations/2026-11-15_*.sql pour la
--      migration incrémentale d'une base déjà créée en v1.
-- v2.1 (2026-11-16) : frais de scolarité — tables `fees` / `payments`
--      (montants GNF + dates uniquement, RLS admin-only).
--      Voir supabase/migrations/2026-11-16_frais_scolarite.sql.
-- v2.2 (2026-11-16) : comptabilité — table `expenses` (dépenses).
--      Voir supabase/migrations/2026-11-16_depenses.sql.

create table classes (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  -- Système guinéen : Maternelle / Primaire / Collège / Lycée (regroupés),
  -- Université à part. Chaque classe porte une option ; le département ne
  -- concerne que l'université (référentiel générique, sans nom d'établissement).
  niveau text,                       -- cycle : maternelle | primaire | college | lycee | universite
  option text,                       -- section (primaire/collège), série (lycée) ou parcours/année (université)
  departement text,                  -- département universitaire (niveau = universite)
  constraint classes_niveau_check
    check (niveau is null or niveau in ('maternelle', 'primaire', 'college', 'lycee', 'universite')),
  constraint classes_departement_check
    check (departement is null or departement in (
      -- Sciences et techniques
      'Mathématiques', 'Physique', 'Chimie', 'Biologie', 'Géologie', 'Informatique',
      -- Sciences de la santé
      'Médecine', 'Pharmacie', 'Odontologie', 'Sciences infirmières', 'Sage-femme', 'Santé publique',
      -- Ingénierie / polytechnique
      'Génie civil', 'Génie électrique', 'Génie mécanique', 'Génie informatique', 'Télécommunications',
      -- Sciences sociales et humaines
      'Sociologie', 'Psychologie', 'Histoire', 'Géographie',
      'Sciences de l''information et de la communication',
      -- Lettres et langues
      'Lettres modernes', 'Anglais', 'Langues nationales',
      -- Droit et sciences politiques
      'Droit privé', 'Droit public', 'Relations internationales',
      -- Économie et gestion
      'Économie', 'Gestion', 'Comptabilité-Finance',
      -- Agronomie et sciences vétérinaires
      'Agronomie', 'Foresterie', 'Sciences vétérinaires',
      -- Sciences de l'éducation
      'Sciences de l''éducation', 'Formation des enseignants',
      -- Mines et environnement
      'Génie minier', 'Sciences de l''environnement'
    )),
  constraint classes_departement_niveau_check
    check (departement is null or niveau = 'universite')
);

create table students (
  id uuid primary key default gen_random_uuid(),
  code_qr text not null unique,          -- identifiant encodé dans le QR de la carte
  nom text not null,
  classe_id uuid not null references classes(id) on delete restrict
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  classe_id uuid not null references classes(id) on delete cascade,
  salle text,                            -- association scan → salle (flux Sprint 2)
  -- créneau hebdomadaire : jour + heure début/fin (heure locale Africa/Conakry)
  jour_semaine int not null check (jour_semaine between 0 and 6), -- 0 = dimanche
  heure_debut time not null,
  heure_fin time not null
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  scanned_at timestamptz not null default now()   -- horodatage serveur (timestamptz), pas client
);

-- Frais de scolarité : minimisation des données (montants GNF + dates seulement,
-- aucune donnée de paiement sensible). Solde et statut DÉRIVÉS (src/lib/scolarite.ts).
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

-- Comptabilité : dépenses saisies par la direction. Recettes = `payments`.
-- Solde DÉRIVÉ (src/lib/comptabilite.ts), jamais stocké.
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

-- Anti-doublon : index UNIQUE d'expression sur élève + cours + journée locale Africa/Conakry.
-- scanned_at (timestamptz) est converti en heure locale Conakry puis on extrait la date scolaire.
-- L'expression utilise `timezone('Africa/Conakry', scanned_at)::date` pour être explicite
-- sur le fuseau, indépendamment du fuseau du serveur.
create unique index attendance_one_per_student_course_conakry_day_idx
  on attendance (student_id, course_id, (timezone('Africa/Conakry', scanned_at)::date));

create index attendance_course_idx on attendance (course_id, scanned_at);
create index students_classe_idx on students (classe_id);  -- vues dashboard par classe
create index classes_niveau_idx on classes (niveau);        -- regroupement dashboard par niveau
create index fees_classe_idx on fees (classe_id);
create index payments_student_idx on payments (student_id);
create index payments_fee_idx on payments (fee_id);
create index expenses_date_idx on expenses (date_depense);
create index expenses_categorie_idx on expenses (categorie);

-- RLS activé sur toutes les tables
alter table classes enable row level security;
alter table students enable row level security;
alter table courses enable row level security;
alter table attendance enable row level security;
alter table fees enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;

-- Privilèges SQL : seuls les rôles authentifiés peuvent toucher les tables (nécessaire pour que RLS
-- puisse s'appliquer via une session admin). Aucun droit n'est accordé au rôle anon (scanner inclus).
grant select, insert, update, delete on classes to authenticated;
grant select, insert, update, delete on students to authenticated;
grant select, insert, update, delete on courses to authenticated;
grant select, insert, update, delete on attendance to authenticated;
grant select, insert, update, delete on fees to authenticated;
grant select, insert, update, delete on payments to authenticated;
grant select, insert, update, delete on expenses to authenticated;
revoke all on classes from anon;
revoke all on students from anon;
revoke all on courses from anon;
revoke all on attendance from anon;
revoke all on fees from anon;
revoke all on payments from anon;
revoke all on expenses from anon;

-- Policies réservées aux admins authentifiés : app_metadata.role = 'admin' (jamais user_metadata).
-- Remplacement des anciennes policies permissives "using (true) with check (true)".
create policy "admin full access classes" on classes
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin full access students" on students
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin full access courses" on courses
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin full access attendance" on attendance
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin full access fees" on fees
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin full access payments" on payments
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin full access expenses" on expenses
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Aucune policy pour anon : les tables sont invisibles sans session admin authentifiée.
-- Le scanner utilise la session admin du poste tablette (login une fois par salle).
-- Aucun droit administrateur n'est accordé au scanner.
