-- Esquema de Ñeque.
--
-- El front nunca habla con PostgREST: todo pasa por el BFF (`server/`), que
-- usa la clave secreta y autoriza cada operacion por propiedad (entrenador
-- dueno del alumno, alumno dueno de su sesion). Por eso RLS queda habilitado
-- en todas las tablas SIN politicas y sin grants para `anon`/`authenticated`:
-- con la clave publica no se lee ni se escribe nada.

create extension if not exists citext with schema extensions;

-- ── Enumeraciones (valores identicos a los del front) ─────────────────────
create type public.user_role         as enum ('trainer', 'student');
create type public.student_status    as enum ('active', 'suspended');
create type public.trainer_plan      as enum ('free', 'pro');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.muscle_group      as enum ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'fullbody');
create type public.exercise_load     as enum ('weight', 'bodyweight', 'weighted_bodyweight');
create type public.exercise_measure  as enum ('reps', 'time');
create type public.workout_status    as enum ('scheduled', 'in_progress', 'completed', 'skipped');
create type public.skip_reason       as enum ('equipment_busy', 'pain', 'no_time', 'other');
create type public.photo_angle       as enum ('front', 'side', 'back');
create type public.session_kind      as enum ('training', 'assessment', 'checkin');
create type public.schedule_status   as enum ('confirmed', 'pending', 'cancelled');
create type public.cancel_reason     as enum ('illness', 'travel', 'injury', 'rescheduled', 'other');
create type public.notification_kind as enum ('routine', 'session', 'message', 'system', 'alert', 'invitation');
create type public.target_type       as enum ('routine', 'session', 'assessment', 'photo', 'student');
create type public.device_platform   as enum ('ios', 'android');

-- ── updated_at ────────────────────────────────────────────────────────────
create schema if not exists private;

create function private.set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── Identidad ─────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role not null,
  -- Copia del correo de auth.users: evita una llamada al admin API por cada
  -- alumno listado. Ñeque no permite cambiar el correo.
  email        extensions.citext not null unique,
  display_name text not null,
  avatar_path  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.trainers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.profiles (id) on delete cascade,
  first_name     text not null,
  last_name      text not null,
  phone          text,
  specialty      text,
  bio            text,
  certifications jsonb not null default '[]' check (jsonb_typeof(certifications) = 'array'),
  plan           public.trainer_plan not null default 'free',
  joined_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.students (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id),
  first_name text not null,
  last_name  text not null,
  phone      text,
  status     public.student_status not null default 'active',
  birth_date date,
  height_cm  numeric(5, 2) check (height_cm between 50 and 260),
  goal       text,
  joined_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_trainer_status_idx on public.students (trainer_id, status);

create table public.invitations (
  -- El token va en claro: el entrenador necesita volver a ver el enlace
  -- vigente (getForStudent). Solo el BFF, con la clave secreta, lo lee.
  token       text primary key,
  student_id  uuid not null references public.students (id) on delete cascade,
  expires_at  timestamptz not null,
  status      public.invitation_status not null default 'pending',
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index invitations_one_pending_idx on public.invitations (student_id) where status = 'pending';

create table public.password_reset_tickets (
  token_hash text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Contador de intentos fallidos. Vive en la base porque cada invocacion de
-- una funcion serverless puede ser otra instancia: en memoria no sirve.
create table public.login_attempts (
  key          text primary key,
  count        smallint not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

-- ── Ficha del alumno ──────────────────────────────────────────────────────
create table public.anamnesis (
  id                         uuid primary key default gen_random_uuid(),
  student_id                 uuid not null unique references public.students (id) on delete cascade,
  medical_history            text,
  previous_injuries          text,
  surgeries                  text,
  medications                text,
  allergies                  text,
  previous_activity          text,
  declared_goal              text not null,
  weekly_availability        jsonb not null check (jsonb_typeof(weekly_availability) = 'array'),
  emergency_contact_name     text,
  emergency_contact_phone    text,
  emergency_contact_relation text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create table public.assessments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students (id) on delete cascade,
  trainer_id     uuid not null references public.trainers (id),
  taken_at       timestamptz not null default now(),
  weight_kg      numeric(5, 2) not null check (weight_kg between 20 and 400),
  height_cm      numeric(5, 2) not null check (height_cm between 50 and 260),
  body_fat_pct   numeric(4, 1) check (body_fat_pct between 2 and 70),
  muscle_mass_kg numeric(5, 2),
  chest_cm       numeric(5, 2),
  waist_cm       numeric(5, 2),
  hip_cm         numeric(5, 2),
  arm_cm         numeric(5, 2),
  thigh_cm       numeric(5, 2),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index assessments_student_idx on public.assessments (student_id, taken_at);

-- ── Rutinas ───────────────────────────────────────────────────────────────
create table public.exercises (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  muscle_group     public.muscle_group not null,
  equipment        text,
  thumbnail_url    text,
  instructions     jsonb not null default '[]' check (jsonb_typeof(instructions) = 'array'),
  owner_trainer_id uuid references public.trainers (id),
  default_load     public.exercise_load,
  default_measure  public.exercise_measure,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index exercises_owner_idx on public.exercises (owner_trainer_id);

create table public.routines (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers (id),
  name       text not null,
  goal       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index routines_trainer_idx on public.routines (trainer_id) where deleted_at is null;

-- Dias y ejercicios no se borran al editar la rutina: se marcan con
-- deleted_at, porque las sesiones ya entrenadas los siguen referenciando.
create table public.routine_days (
  id                uuid primary key default gen_random_uuid(),
  routine_id        uuid not null references public.routines (id),
  weekday           smallint not null check (weekday between 1 and 7),
  title             text not null,
  focus             public.muscle_group not null,
  estimated_minutes integer not null check (estimated_minutes > 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create unique index routine_days_weekday_idx on public.routine_days (routine_id, weekday) where deleted_at is null;

create table public.routine_exercises (
  id               uuid primary key default gen_random_uuid(),
  routine_day_id   uuid not null references public.routine_days (id),
  exercise_id      uuid not null references public.exercises (id),
  name             text not null,
  position         integer not null,
  sets             integer not null check (sets between 1 and 50),
  reps             integer not null check (reps between 0 and 500),
  rest_seconds     integer not null check (rest_seconds between 0 and 3600),
  weight_kg        numeric(6, 2),
  notes            text,
  load             public.exercise_load,
  measure          public.exercise_measure,
  duration_seconds integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create unique index routine_exercises_position_idx on public.routine_exercises (routine_day_id, position) where deleted_at is null;

create table public.routine_assignments (
  id         uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id),
  student_id uuid not null references public.students (id),
  start_date date not null,
  end_date   date check (end_date is null or end_date >= start_date),
  ended_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un alumno hace una sola rutina a la vez.
create unique index routine_assignments_one_active_idx on public.routine_assignments (student_id) where ended_at is null;
create index routine_assignments_routine_idx on public.routine_assignments (routine_id) where ended_at is null;

-- ── Ejecucion ─────────────────────────────────────────────────────────────
create table public.workout_sessions (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.students (id),
  routine_id        uuid not null references public.routines (id),
  routine_day_id    uuid not null references public.routine_days (id),
  title             text not null,
  scheduled_for     timestamptz not null,
  scheduled_date    date not null,
  started_at        timestamptz,
  completed_at      timestamptz,
  status            public.workout_status not null default 'scheduled',
  duration_minutes  integer,
  estimated_minutes integer not null,
  completion_note   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index workout_sessions_day_idx on public.workout_sessions (student_id, routine_day_id, scheduled_date);
create index workout_sessions_student_idx on public.workout_sessions (student_id, scheduled_for);

create table public.workout_exercise_logs (
  id                  uuid primary key default gen_random_uuid(),
  workout_session_id  uuid not null references public.workout_sessions (id) on delete cascade,
  routine_exercise_id uuid not null references public.routine_exercises (id),
  exercise_id         uuid not null references public.exercises (id),
  position            integer not null,
  name                text not null,
  target_sets         integer not null,
  target_reps         integer not null,
  rest_seconds        integer not null,
  weight_kg           numeric(6, 2),
  load                public.exercise_load,
  measure             public.exercise_measure,
  duration_seconds    integer,
  completed_sets      integer not null default 0,
  done                boolean not null default false,
  skipped             boolean not null default false,
  skip_reason         public.skip_reason,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (workout_session_id, routine_exercise_id)
);

create table public.workout_sets (
  id                      uuid primary key default gen_random_uuid(),
  workout_exercise_log_id uuid not null references public.workout_exercise_logs (id) on delete cascade,
  set_number              smallint not null,
  reps                    integer,
  weight_kg               numeric(6, 2),
  duration_seconds        integer,
  skipped                 boolean not null default false,
  skip_reason             public.skip_reason,
  completed_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  unique (workout_exercise_log_id, set_number)
);

-- ── Progreso, agenda, notificaciones ──────────────────────────────────────
create table public.progress_photos (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id),
  taken_at     timestamptz not null,
  storage_path text not null check (storage_path like student_id::text || '/%'),
  angle        public.photo_angle not null,
  weight_kg    numeric(5, 2),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index progress_photos_student_idx on public.progress_photos (student_id, taken_at) where deleted_at is null;

create table public.scheduled_sessions (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.students (id),
  trainer_id          uuid not null references public.trainers (id),
  title               text not null,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  location            text,
  kind                public.session_kind not null,
  status              public.schedule_status not null default 'pending',
  workout_session_id  uuid references public.workout_sessions (id),
  cancellation_reason public.cancel_reason,
  cancellation_note   text,
  cancelled_at        timestamptz,
  cancelled_by        uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status <> 'cancelled' or cancellation_reason is not null),
  check (cancellation_reason is distinct from 'other' or length(trim(coalesce(cancellation_note, ''))) > 0)
);
create index scheduled_sessions_student_idx on public.scheduled_sessions (student_id, starts_at);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        public.notification_kind not null,
  title       text not null,
  body        text not null,
  read_at     timestamptz,
  target_type public.target_type,
  target_id   uuid,
  -- Las alertas derivadas (sesion completada, dolor, riesgo) se generan al
  -- leer la bandeja; la clave evita repetirlas.
  dedupe_key  text unique,
  created_at  timestamptz not null default now(),
  check ((target_type is null) = (target_id is null))
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.device_tokens (
  token        text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  platform     public.device_platform not null,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ── Triggers de updated_at ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'trainers', 'students', 'invitations', 'anamnesis', 'assessments',
    'exercises', 'routines', 'routine_days', 'routine_exercises', 'routine_assignments',
    'workout_sessions', 'workout_exercise_logs', 'progress_photos', 'scheduled_sessions'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- ── Permisos del BFF ──────────────────────────────────────────────────────
-- El proyecto se crea sin exponer tablas nuevas automaticamente: el unico
-- rol con acceso es `service_role`, el de la clave secreta que usa el BFF.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ── RLS: habilitado y cerrado ─────────────────────────────────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
