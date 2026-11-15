-- VerifyCheck — MVP schema (v2, 2026-11)
-- À exécuter manuellement dans l'éditeur SQL Supabase après validation humaine.
-- Principe : minimisation des données élèves (pas de photo, pas d'email),
-- RLS stricte réservée aux admins, fuseau scolaire Africa/Conakry.
--
-- v2 : niveaux (cycles) + option + département universitaire sur `classes`
--      (système guinéen). Voir supabase/migrations/2026-11-15_*.sql pour la
--      migration incrémentale d'une base déjà créée en v1.

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

-- Anti-doublon : index UNIQUE d'expression sur élève + cours + journée locale Africa/Conakry.
-- scanned_at (timestamptz) est converti en heure locale Conakry puis on extrait la date scolaire.
-- Pas de contrainte UNIQUE sur expression : on utilise un index unique d'expression.
create unique index attendance_one_per_student_course_conakry_day_idx
  on attendance (student_id, course_id, date(scanned_at AT TIME ZONE 'Africa/Conakry'));

create index attendance_course_idx on attendance (course_id, scanned_at);
create index students_classe_idx on students (classe_id);  -- vues dashboard par classe
create index classes_niveau_idx on classes (niveau);        -- regroupement dashboard par niveau

-- RLS activé sur toutes les tables
alter table classes enable row level security;
alter table students enable row level security;
alter table courses enable row level security;
alter table attendance enable row level security;

-- Privilèges SQL : seuls les rôles authentifiés peuvent toucher les tables (nécessaire pour que RLS
-- puisse s'appliquer via une session admin). Aucun droit n'est accordé au rôle anon (scanner inclus).
grant select, insert, update, delete on classes to authenticated;
grant select, insert, update, delete on students to authenticated;
grant select, insert, update, delete on courses to authenticated;
grant select, insert, update, delete on attendance to authenticated;
revoke all on classes from anon;
revoke all on students from anon;
revoke all on courses from anon;
revoke all on attendance from anon;

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

-- Aucune policy pour anon : les tables sont invisibles sans session admin authentifiée.
-- Le scanner utilise la session admin du poste tablette (login une fois par salle).
-- Aucun droit administrateur n'est accordé au scanner.
