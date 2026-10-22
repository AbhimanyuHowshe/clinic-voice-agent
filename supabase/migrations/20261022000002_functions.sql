-- Server-side logic: membership checks, effective agent availability, slot lookup and
-- concurrency-safe booking, rescheduling and cancellation.
-- Booking functions are executable by service_role only (the voice agent backend).

-- ---------------------------------------------------------------------------
-- Staff membership
-- ---------------------------------------------------------------------------

create or replace function public.is_clinic_member(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.clinic_id = p_clinic_id
  );
$$;

create or replace function public.is_clinic_admin(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.clinic_id = p_clinic_id and p.role = 'admin'
  );
$$;

create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g');
$$;

-- Last 10 digits, so "+91 98765 43210" and "9876543210" match.
create or replace function public.phone_key(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 10);
$$;

-- ---------------------------------------------------------------------------
-- Effective agent availability
-- Precedence: manual OFF > holiday > temporary pause > schedule (if enabled) > available.
-- ---------------------------------------------------------------------------

create or replace function public.agent_effective_state(
  p_clinic_id uuid,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_settings public.agent_settings;
  v_local timestamp;
  v_dow int;
  v_reason text := null;
begin
  if auth.role() = 'authenticated' and not public.is_clinic_member(p_clinic_id) then
    raise exception 'not a member of this clinic' using errcode = '42501';
  end if;

  select c.timezone into v_tz from public.clinics c where c.id = p_clinic_id;
  if v_tz is null then
    raise exception 'unknown clinic' using errcode = 'P0002';
  end if;
  select * into v_settings from public.agent_settings s where s.clinic_id = p_clinic_id;

  v_local := p_at at time zone v_tz;
  v_dow := extract(dow from v_local)::int;

  if not coalesce(v_settings.manual_enabled, false) then
    v_reason := 'manual_off';
  elsif exists (
    select 1 from public.clinic_holidays h
    where h.clinic_id = p_clinic_id and h.day = v_local::date
  ) then
    v_reason := 'holiday';
  elsif exists (
    select 1 from public.temporary_pauses tp
    where tp.clinic_id = p_clinic_id and p_at >= tp.starts_at and p_at < tp.ends_at
  ) then
    v_reason := 'paused';
  elsif v_settings.schedule_enabled and not exists (
    select 1 from public.agent_schedules w
    where w.clinic_id = p_clinic_id and (
      -- same-day window
      (w.end_time > w.start_time and w.weekday = v_dow
        and v_local::time >= w.start_time and v_local::time < w.end_time)
      -- overnight window, evening part
      or (w.end_time < w.start_time and w.weekday = v_dow and v_local::time >= w.start_time)
      -- overnight window, after-midnight part (started the previous day)
      or (w.end_time < w.start_time and w.weekday = (v_dow + 6) % 7 and v_local::time < w.end_time)
    )
  ) then
    v_reason := 'outside_hours';
  end if;

  return jsonb_build_object(
    'available', v_reason is null,
    'reason', coalesce(v_reason, 'available'),
    'fallback_mode', v_settings.fallback_mode,
    'fallback_message', v_settings.fallback_message,
    'transfer_number', v_settings.transfer_number,
    'ongoing_call_policy', v_settings.ongoing_call_policy,
    'timezone', v_tz,
    'local_time', to_char(v_local, 'YYYY-MM-DD"T"HH24:MI')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Slots
-- ---------------------------------------------------------------------------

-- Free slots for one doctor on one clinic-local date. Only real schedule windows produce
-- slots; holidays, past times (plus 15 min lead) and overlapping live bookings are removed.
-- p_ignore_appointment lets a reschedule ignore the appointment being moved.
create or replace function public.available_slots(
  p_doctor_id uuid,
  p_day date,
  p_ignore_appointment uuid default null
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with doc as (
    select d.id, d.clinic_id, d.slot_minutes, c.timezone
    from public.doctors d
    join public.clinics c on c.id = d.clinic_id
    where d.id = p_doctor_id and d.active
  ),
  candidate as (
    select
      (g at time zone doc.timezone) as starts_at,
      ((g + make_interval(mins => doc.slot_minutes)) at time zone doc.timezone) as ends_at,
      doc.id as doctor_id
    from doc
    join public.doctor_schedules s
      on s.doctor_id = doc.id and s.weekday = extract(dow from p_day)::int
    cross join lateral generate_series(
      p_day + s.start_time,
      p_day + s.end_time - make_interval(mins => doc.slot_minutes),
      make_interval(mins => doc.slot_minutes)
    ) as g
    where not exists (
      select 1 from public.clinic_holidays h where h.clinic_id = doc.clinic_id and h.day = p_day
    )
  )
  select distinct c.starts_at, c.ends_at
  from candidate c
  where c.starts_at > now() + interval '15 minutes'
    and not exists (
      select 1 from public.appointments a
      where a.doctor_id = c.doctor_id
        and a.status = 'booked'
        and a.id is distinct from p_ignore_appointment
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(c.starts_at, c.ends_at)
    )
  order by c.starts_at;
$$;

create or replace function public.is_bookable_slot(
  p_doctor_id uuid,
  p_starts_at timestamptz,
  p_ignore_appointment uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.doctors d
    join public.clinics c on c.id = d.clinic_id
    cross join lateral public.available_slots(
      d.id, (p_starts_at at time zone c.timezone)::date, p_ignore_appointment
    ) s
    where d.id = p_doctor_id and s.starts_at = p_starts_at
  );
$$;

create or replace function public.new_appointment_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_ref text;
begin
  -- Six digits: easy to say and hear over a voice call.
  loop
    v_ref := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.appointments a where a.reference = v_ref);
  end loop;
  return v_ref;
end;
$$;

create or replace function public.appointment_json(a public.appointments)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'reference', a.reference,
    'doctor_id', a.doctor_id,
    'doctor_name', (select d.name from public.doctors d where d.id = a.doctor_id),
    'patient_name', a.patient_name,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'status', a.status
  );
$$;

-- ---------------------------------------------------------------------------
-- Booking (voice agent backend only)
-- ---------------------------------------------------------------------------

create or replace function public.book_appointment(
  p_clinic_id uuid,
  p_doctor_id uuid,
  p_starts_at timestamptz,
  p_patient_name text,
  p_patient_phone text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_existing public.appointments;
  v_doctor public.doctors;
  v_row public.appointments;
  v_phone text := public.normalize_phone(p_patient_phone);
  v_name text := btrim(coalesce(p_patient_name, ''));
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_idempotency_key');
  end if;

  -- A retried request returns the original result instead of booking twice.
  select * into v_existing from public.appointments a where a.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('ok', true, 'replayed', true, 'appointment', public.appointment_json(v_existing));
  end if;

  if length(v_name) < 1 or length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;
  if v_phone !~ '^\+?[0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  select * into v_doctor from public.doctors d
  where d.id = p_doctor_id and d.clinic_id = p_clinic_id and d.active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_doctor');
  end if;

  if not (public.agent_effective_state(p_clinic_id) ->> 'available')::boolean then
    return jsonb_build_object('ok', false, 'error', 'agent_unavailable');
  end if;

  if not public.is_bookable_slot(p_doctor_id, p_starts_at) then
    return jsonb_build_object('ok', false, 'error', 'slot_unavailable');
  end if;

  begin
    insert into public.appointments (
      clinic_id, doctor_id, patient_name, patient_phone, starts_at, ends_at,
      reference, idempotency_key, source
    ) values (
      p_clinic_id, p_doctor_id, v_name, v_phone, p_starts_at,
      p_starts_at + make_interval(mins => v_doctor.slot_minutes),
      public.new_appointment_reference(), p_idempotency_key, 'agent'
    )
    returning * into v_row;
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'error', 'slot_taken');
    when unique_violation then
      -- Concurrent retry with the same idempotency key won the race.
      select * into v_existing from public.appointments a where a.idempotency_key = p_idempotency_key;
      if found then
        return jsonb_build_object('ok', true, 'replayed', true, 'appointment', public.appointment_json(v_existing));
      end if;
      return jsonb_build_object('ok', false, 'error', 'conflict');
  end;

  return jsonb_build_object('ok', true, 'replayed', false, 'appointment', public.appointment_json(v_row));
end;
$$;

-- Patient verification: the booking reference plus the phone number used to book.
create or replace function public.find_appointment(
  p_clinic_id uuid,
  p_reference text,
  p_phone text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
begin
  select * into v_row from public.appointments a
  where a.clinic_id = p_clinic_id
    and a.reference = regexp_replace(coalesce(p_reference, ''), '[^0-9]', '', 'g')
    and public.phone_key(a.patient_phone) = public.phone_key(p_phone)
    and length(public.phone_key(p_phone)) >= 8;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'appointment', public.appointment_json(v_row));
end;
$$;

create or replace function public.cancel_appointment(
  p_clinic_id uuid,
  p_reference text,
  p_phone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
begin
  select * into v_row from public.appointments a
  where a.clinic_id = p_clinic_id
    and a.reference = regexp_replace(coalesce(p_reference, ''), '[^0-9]', '', 'g')
    and public.phone_key(a.patient_phone) = public.phone_key(p_phone)
    and length(public.phone_key(p_phone)) >= 8
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.status = 'cancelled' then
    -- Idempotent: cancelling twice reports success.
    return jsonb_build_object('ok', true, 'replayed', true, 'appointment', public.appointment_json(v_row));
  end if;
  if v_row.status <> 'booked' or v_row.starts_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable');
  end if;
  if not (public.agent_effective_state(p_clinic_id) ->> 'available')::boolean then
    return jsonb_build_object('ok', false, 'error', 'agent_unavailable');
  end if;

  update public.appointments set status = 'cancelled' where id = v_row.id returning * into v_row;
  return jsonb_build_object('ok', true, 'replayed', false, 'appointment', public.appointment_json(v_row));
end;
$$;

create or replace function public.reschedule_appointment(
  p_clinic_id uuid,
  p_reference text,
  p_phone text,
  p_new_starts_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
  v_minutes int;
begin
  select * into v_row from public.appointments a
  where a.clinic_id = p_clinic_id
    and a.reference = regexp_replace(coalesce(p_reference, ''), '[^0-9]', '', 'g')
    and public.phone_key(a.patient_phone) = public.phone_key(p_phone)
    and length(public.phone_key(p_phone)) >= 8
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_row.status = 'booked' and v_row.starts_at = p_new_starts_at then
    -- Idempotent: a retried reschedule to the same time reports success.
    return jsonb_build_object('ok', true, 'replayed', true, 'appointment', public.appointment_json(v_row));
  end if;
  if v_row.status <> 'booked' or v_row.starts_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'not_reschedulable');
  end if;
  if not (public.agent_effective_state(p_clinic_id) ->> 'available')::boolean then
    return jsonb_build_object('ok', false, 'error', 'agent_unavailable');
  end if;
  if not public.is_bookable_slot(v_row.doctor_id, p_new_starts_at, v_row.id) then
    return jsonb_build_object('ok', false, 'error', 'slot_unavailable');
  end if;

  select d.slot_minutes into v_minutes from public.doctors d where d.id = v_row.doctor_id;
  begin
    update public.appointments
    set starts_at = p_new_starts_at,
        ends_at = p_new_starts_at + make_interval(mins => v_minutes)
    where id = v_row.id
    returning * into v_row;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end;
  return jsonb_build_object('ok', true, 'replayed', false, 'appointment', public.appointment_json(v_row));
end;
$$;
