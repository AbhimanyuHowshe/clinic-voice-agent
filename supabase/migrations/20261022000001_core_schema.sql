-- Core schema: clinics, staff profiles, doctors, FAQs, appointments, agent controls, logs.
-- All timestamps are timestamptz (UTC); clinic-local display uses clinics.timezone.
-- "Automatically expose new tables" is off, so every table needs explicit GRANTs.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_timezone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(name) between 2 and 120),
  timezone text not null check (public.is_valid_timezone(timezone)),
  country text not null check (country in ('IN', 'AU')),
  phone text,
  address text,
  -- STT/TTS language for this clinic's voice sessions, e.g. 'hi-IN' or 'en-IN'.
  voice_language text not null default 'hi-IN',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);
create index on public.profiles (clinic_id);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  specialty text not null default 'General Physician',
  slot_minutes integer not null default 15 check (slot_minutes between 5 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.doctors (clinic_id);

-- Weekly consulting hours, in clinic-local time. weekday: 0 = Sunday ... 6 = Saturday.
create table public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);
create index on public.doctor_schedules (doctor_id, weekday);

-- Clinic-wide closed days (clinic-local dates). No bookings and no agent on these days.
create table public.clinic_holidays (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  day date not null,
  reason text not null default '',
  unique (clinic_id, day)
);

create table public.clinic_faqs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  question text not null check (length(question) between 3 and 500),
  answer text not null check (length(answer) between 1 and 2000),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index on public.clinic_faqs (clinic_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete restrict,
  patient_name text not null check (length(patient_name) between 1 and 120),
  patient_phone text not null check (patient_phone ~ '^\+?[0-9]{8,15}$'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked'
    check (status in ('booked', 'cancelled', 'completed', 'no_show')),
  reference text not null unique,
  idempotency_key text unique,
  source text not null default 'agent' check (source in ('agent', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  -- Concurrency-safe double-booking prevention: no two live bookings may overlap per doctor.
  constraint appointments_no_overlap exclude using gist (
    doctor_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'booked')
);
create index on public.appointments (clinic_id, starts_at);

create table public.agent_settings (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  -- Manual emergency switch: false overrides every schedule.
  manual_enabled boolean not null default true,
  -- When true, the agent only answers inside agent_schedules windows.
  schedule_enabled boolean not null default false,
  fallback_mode text not null default 'closed_message'
    check (fallback_mode in ('closed_message', 'transfer', 'voicemail')),
  fallback_message text not null default
    'Our AI receptionist is not available right now. Please call the clinic during opening hours.',
  transfer_number text,
  -- What a call already in progress does when the agent becomes unavailable:
  -- 'finish' lets it talk on but blocks booking changes; 'end' says goodbye and hangs up.
  ongoing_call_policy text not null default 'finish' check (ongoing_call_policy in ('finish', 'end')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- Agent operating windows in clinic-local time. end_time <= start_time means the window
-- runs overnight into the next day (e.g. 20:00 -> 02:00).
create table public.agent_schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time <> end_time)
);
create index on public.agent_schedules (clinic_id, weekday);

create table public.temporary_pauses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);
create index on public.temporary_pauses (clinic_id, ends_at);

-- One row per voice session. No transcripts or recordings are stored.
create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  room_name text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  outcome text not null default 'in_progress'
    check (outcome in ('in_progress', 'completed', 'rejected_unavailable', 'escalated', 'error')),
  actions text[] not null default '{}',
  escalation_reason text,
  callback_phone text check (callback_phone is null or callback_phone ~ '^\+?[0-9]{8,15}$'),
  follow_up_done boolean not null default false
);
create index on public.call_logs (clinic_id, started_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  clinic_id uuid,
  actor uuid,
  action text not null,
  table_name text not null,
  row_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (clinic_id, created_at desc);

create trigger doctors_touch before update on public.doctors
  for each row execute function public.touch_updated_at();
create trigger faqs_touch before update on public.clinic_faqs
  for each row execute function public.touch_updated_at();
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();
create trigger agent_settings_touch before update on public.agent_settings
  for each row execute function public.touch_updated_at();

-- Every clinic gets agent settings.
create or replace function public.create_agent_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.agent_settings (clinic_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger clinics_agent_settings after insert on public.clinics
  for each row execute function public.create_agent_settings();

-- ---------------------------------------------------------------------------
-- Audit trail for administrative changes
-- ---------------------------------------------------------------------------

create or replace function public.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_clinic uuid;
begin
  -- Keep patient contact details out of the audit trail.
  if tg_table_name = 'appointments' then
    v_old := v_old - 'patient_name' - 'patient_phone';
    v_new := v_new - 'patient_name' - 'patient_phone';
  end if;
  v_clinic := coalesce(
    (rec ->> 'clinic_id')::uuid,
    (select d.clinic_id from public.doctors d where d.id = (rec ->> 'doctor_id')::uuid)
  );
  insert into public.audit_logs (clinic_id, actor, action, table_name, row_id, old_data, new_data)
  values (
    v_clinic,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'clinic_id'),
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'agent_settings', 'agent_schedules', 'temporary_pauses', 'clinic_holidays',
    'doctors', 'doctor_schedules', 'clinic_faqs', 'appointments', 'profiles'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_change()', t || '_audit', t);
  end loop;
end;
$$;
