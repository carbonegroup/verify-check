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
  classe_id uuid not null references classes(id) on delete restrict,
  photo_url text                         -- chemin Supabase Storage vers photo de profil (ex. public/students/uuid.png)
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


-- The full schema includes the same additive 2.0 upgrade as the production migration.
-- Keep this block in sync with supabase/migrations/20261124190000_academic_management_dev_roles.sql.
-- VerifyCheck 2.0 — academic management, operational roles and isolated test fixtures.
-- Additive migration: preserves all existing classes, students, courses and attendance.
begin;

alter table public.classes
  add column if not exists archived_at timestamptz,
  add column if not exists is_demo boolean not null default false;

alter table public.students
  add column if not exists prenom text,
  add column if not exists email text,
  add column if not exists telephone text,
  add column if not exists archived_at timestamptz,
  add column if not exists is_demo boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.courses
  add column if not exists enseignant text,
  add column if not exists archived_at timestamptz,
  add column if not exists is_demo boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.attendance
  add column if not exists statut text not null default 'present',
  add column if not exists source text not null default 'scan',
  add column if not exists motif text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.attendance
  drop constraint if exists attendance_statut_check,
  add constraint attendance_statut_check check (statut in ('present', 'absent', 'retard')),
  drop constraint if exists attendance_source_check,
  add constraint attendance_source_check check (source in ('scan', 'manual'));

create index if not exists students_classe_active_idx
  on public.students (classe_id, nom) where archived_at is null;
create index if not exists courses_classe_schedule_active_idx
  on public.courses (classe_id, jour_semaine, heure_debut, heure_fin)
  where archived_at is null;
create index if not exists attendance_status_scanned_at_idx
  on public.attendance (statut, scanned_at desc);

-- Authoritative role registry: unlike JWT app_metadata, this can revoke direct
-- Data API access immediately when an account is disabled or demoted.
create table if not exists public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'dev')),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.app_user_roles enable row level security;
revoke all on public.app_user_roles from anon, authenticated;
grant select on public.app_user_roles to authenticated;
grant all on public.app_user_roles to service_role;
create policy "users can read own application role" on public.app_user_roles
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Migrate every existing ADMIN from the trusted app_metadata claim. No account
-- is promoted to DEV by this migration.
insert into public.app_user_roles (user_id, role, is_active)
select u.id, 'admin', true
from auth.users as u
where u.raw_app_meta_data ->> 'role' = 'admin'
on conflict (user_id) do nothing;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.role
  from public.app_user_roles as r
  where r.user_id = (select auth.uid())
    and r.is_active is true
  limit 1
$$;

create or replace function private.has_app_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) = required_role, false)
$$;

create or replace function private.is_operational_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) in ('admin', 'dev'), false)
$$;

revoke all on function private.current_app_role() from public, anon;
revoke all on function private.has_app_role(text) from public, anon;
revoke all on function private.is_operational_user() from public, anon;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.has_app_role(text) to authenticated;
grant execute on function private.is_operational_user() to authenticated;

-- Serialize role revocations so two concurrent account changes cannot remove
-- the final active DEV account. This applies even to privileged service-role writes.
create or replace function private.prevent_last_active_dev()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_devs bigint;
  removing_active_dev boolean;
begin
  perform pg_advisory_xact_lock(74001, 20261124);
  if tg_op = 'DELETE' then
    removing_active_dev := old.role = 'dev' and old.is_active;
  else
    removing_active_dev := old.role = 'dev' and old.is_active
      and (new.role <> 'dev' or new.is_active is not true);
  end if;

  if removing_active_dev then
    select count(*) into remaining_devs
    from public.app_user_roles
    where role = 'dev' and is_active is true and user_id <> old.user_id;
    if remaining_devs < 1 then
      raise exception 'last_active_dev_protected'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.prevent_last_active_dev() from public, anon, authenticated;
drop trigger if exists protect_last_active_dev on public.app_user_roles;
create trigger protect_last_active_dev
  before update or delete on public.app_user_roles
  for each row execute function private.prevent_last_active_dev();

-- Replace the single-role policies without exposing DEV-only fixtures to ADMIN.
drop policy if exists "admin full access classes" on public.classes;
create policy "operational access classes" on public.classes
  for all to authenticated
  using (
    (select private.has_app_role('dev'))
    or ((select private.has_app_role('admin')) and is_demo is false)
  )
  with check (
    (select private.has_app_role('dev'))
    or ((select private.has_app_role('admin')) and is_demo is false)
  );

drop policy if exists "admin full access students" on public.students;
create policy "operational access students" on public.students
  for all to authenticated
  using (
    (select private.has_app_role('dev'))
    or ((select private.has_app_role('admin')) and is_demo is false)
  )
  with check (
    (select private.has_app_role('dev'))
    or ((select private.has_app_role('admin')) and is_demo is false)
  );

drop policy if exists "admin full access courses" on public.courses;
create policy "operational access courses" on public.courses
  for all to authenticated
  using (
    (select private.has_app_role('dev'))
    or ((select private.has_app_role('admin')) and is_demo is false)
  )
  with check (
    (select private.has_app_role('dev'))
    or ((select private.has_app_role('admin')) and is_demo is false)
  );

drop policy if exists "admin full access attendance" on public.attendance;
create policy "operational access attendance" on public.attendance
  for all to authenticated
  using (
    (select private.has_app_role('dev'))
    or (
      (select private.has_app_role('admin'))
      and exists (
        select 1 from public.students s
        where s.id = attendance.student_id and s.is_demo is false
      )
      and exists (
        select 1 from public.courses c
        where c.id = attendance.course_id and c.is_demo is false
      )
    )
  )
  with check (
    (select private.has_app_role('dev'))
    or (
      (select private.has_app_role('admin'))
      and exists (
        select 1 from public.students s
        where s.id = attendance.student_id and s.is_demo is false
      )
      and exists (
        select 1 from public.courses c
        where c.id = attendance.course_id and c.is_demo is false
      )
    )
  );

-- Financial tables retain their existing data model but now accept both operational roles.
drop policy if exists "admin full access fees" on public.fees;
create policy "operational access fees" on public.fees
  for all to authenticated
  using ((select private.is_operational_user()))
  with check ((select private.is_operational_user()));

drop policy if exists "admin full access payments" on public.payments;
create policy "operational access payments" on public.payments
  for all to authenticated
  using ((select private.is_operational_user()))
  with check ((select private.is_operational_user()));

drop policy if exists "admin full access expenses" on public.expenses;
create policy "operational access expenses" on public.expenses
  for all to authenticated
  using ((select private.is_operational_user()))
  with check ((select private.is_operational_user()));

-- Append-only audit log. Only DEV can read it; writes are performed by triggers
-- or trusted server-side account-management routes.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'INVITE', 'ROLE_CHANGE', 'ACCOUNT_DISABLE', 'ACCOUNT_ENABLE', 'PASSWORD_RESET')),
  entity_table text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public, anon, authenticated;
-- ADMIN and DEV may read the activity feed, but only its non-sensitive summary columns.
-- Detailed old/new payloads remain available exclusively through the DEV server endpoint.
grant select (id, actor_role, action, entity_table, entity_id, created_at)
  on public.audit_logs to authenticated;
grant select, insert on public.audit_logs to service_role;
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
drop policy if exists "dev can read audit log" on public.audit_logs;
create policy "operational roles can read activity summary" on public.audit_logs
  for select to authenticated
  using ((select private.is_operational_user()));

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  row_id uuid;
  actor_role text;
begin
  if tg_op = 'INSERT' then
    new_row := to_jsonb(new);
    row_id := (new_row ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    old_row := to_jsonb(old);
    new_row := to_jsonb(new);
    row_id := (new_row ->> 'id')::uuid;
  else
    old_row := to_jsonb(old);
    row_id := (old_row ->> 'id')::uuid;
  end if;

  if tg_table_name = 'students' then
    old_row := old_row - 'code_qr' - 'photo_url' - 'email' - 'telephone';
    new_row := new_row - 'code_qr' - 'photo_url' - 'email' - 'telephone';
  end if;

  actor_role := (select private.current_app_role());
  insert into public.audit_logs (
    actor_id, actor_role, action, entity_table, entity_id, old_data, new_data
  ) values (
    (select auth.uid()), actor_role, tg_op, tg_table_name, row_id, old_row, new_row
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.audit_row_change() from public, anon, authenticated;

drop trigger if exists audit_classes_changes on public.classes;
create trigger audit_classes_changes after insert or update or delete on public.classes
  for each row execute function private.audit_row_change();
drop trigger if exists audit_students_changes on public.students;
create trigger audit_students_changes after insert or update or delete on public.students
  for each row execute function private.audit_row_change();
drop trigger if exists audit_courses_changes on public.courses;
create trigger audit_courses_changes after insert or update or delete on public.courses
  for each row execute function private.audit_row_change();
drop trigger if exists audit_attendance_changes on public.attendance;
create trigger audit_attendance_changes after insert or update or delete on public.attendance
  for each row execute function private.audit_row_change();

-- Seed a clearly marked, DEV-only demo class, three fake students and one
-- 24-hour course for every weekday. These rows are excluded from ADMIN RLS and
-- normal dashboard queries; they never masquerade as real academic records.
do $$
declare
  demo_class_id uuid;
  demo_code_prefix text;
  day_index integer;
  day_names text[] := array['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  student_index integer;
begin
  insert into public.classes (nom, niveau, "option", is_demo)
  values ('[TEST UNIQUEMENT] VerifyCheck — disponibilité 24/7', 'universite', 'DEMO', true)
  on conflict (nom) do nothing;

  select id into demo_class_id
  from public.classes
  where nom = '[TEST UNIQUEMENT] VerifyCheck — disponibilité 24/7'
    and is_demo is true
  limit 1;

  if demo_class_id is null then
    raise exception 'Le nom réservé de la classe de test existe déjà comme donnée non-démo; aucune donnée modifiée.';
  end if;

  demo_code_prefix := 'VC-DEMO-' || upper(replace(left(demo_class_id::text, 8), '-', ''));

  for student_index in 1..3 loop
    insert into public.students (code_qr, nom, prenom, classe_id, is_demo)
    values (
      demo_code_prefix || '-' || lpad(student_index::text, 3, '0'),
      'Élève de test ' || lpad(student_index::text, 2, '0'),
      'Démo',
      demo_class_id,
      true
    )
    on conflict (code_qr) do nothing;
  end loop;

  for day_index in 0..6 loop
    insert into public.courses (
      nom, classe_id, salle, jour_semaine, heure_debut, heure_fin, enseignant, is_demo
    )
    select
      '[TEST 24H] ' || day_names[day_index + 1],
      demo_class_id,
      'SALLE TEST',
      day_index,
      time '00:00',
      time '23:59',
      'Compte DEV',
      true
    where not exists (
      select 1 from public.courses
      where classe_id = demo_class_id
        and jour_semaine = day_index
        and is_demo is true
    );
  end loop;
end;
$$;


-- Enforce schedule integrity at the database boundary, including concurrent writes.
-- The advisory transaction lock serializes course-slot writes before checking overlap.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.courses'::regclass
      and conname = 'courses_time_order_check'
  ) then
    alter table public.courses
      add constraint courses_time_order_check
      check (heure_debut < heure_fin) not valid;
  end if;
end;
$$;

create or replace function private.prevent_course_schedule_conflicts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(74002, 20261124);

  if exists (
    select 1
    from public.courses as c
    where c.id is distinct from new.id
      and c.is_demo = new.is_demo
      and c.archived_at is null
      and c.jour_semaine = new.jour_semaine
      and new.heure_debut < c.heure_fin
      and new.heure_fin > c.heure_debut
      and (
        c.classe_id = new.classe_id
        or (
          nullif(lower(btrim(coalesce(new.enseignant, ''))), '') is not null
          and lower(btrim(coalesce(c.enseignant, ''))) = lower(btrim(new.enseignant))
        )
        or (
          nullif(lower(btrim(coalesce(new.salle, ''))), '') is not null
          and lower(btrim(coalesce(c.salle, ''))) = lower(btrim(new.salle))
        )
      )
  ) then
    raise exception 'course_schedule_conflict'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;
revoke all on function private.prevent_course_schedule_conflicts() from public, anon, authenticated;
drop trigger if exists prevent_course_schedule_conflicts on public.courses;
create trigger prevent_course_schedule_conflicts
  before insert or update of classe_id, enseignant, salle, jour_semaine,
    heure_debut, heure_fin, archived_at, is_demo
  on public.courses
  for each row execute function private.prevent_course_schedule_conflicts();

commit;
