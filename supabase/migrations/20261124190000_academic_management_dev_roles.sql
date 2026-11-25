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
as $
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
$;
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
revoke all on public.audit_logs from anon;
revoke insert, update, delete on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert on public.audit_logs to service_role;
create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create policy "dev can read audit log" on public.audit_logs
  for select to authenticated
  using ((select private.has_app_role('dev')));

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
