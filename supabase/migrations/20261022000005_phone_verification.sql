-- Patients now identify their appointment by phone number only (no reference number).
-- The agent lists the caller's upcoming appointments for that number; cancel and reschedule
-- act on an appointment id and still require the same phone number to match.
-- The reference column stays for staff use in the dashboard.

drop function if exists public.find_appointment(uuid, text, text);
drop function if exists public.cancel_appointment(uuid, text, text);
drop function if exists public.reschedule_appointment(uuid, text, text, timestamptz);

create or replace function public.find_appointments_by_phone(
  p_clinic_id uuid,
  p_phone text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(public.appointment_json(a) order by a.starts_at), '[]'::jsonb)
  from public.appointments a
  where a.clinic_id = p_clinic_id
    and length(public.phone_key(p_phone)) >= 8
    and public.phone_key(a.patient_phone) = public.phone_key(p_phone)
    and a.status = 'booked'
    and a.starts_at > now();
$$;

create or replace function public.cancel_appointment(
  p_clinic_id uuid,
  p_appointment_id uuid,
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
  where a.id = p_appointment_id
    and a.clinic_id = p_clinic_id
    and length(public.phone_key(p_phone)) >= 8
    and public.phone_key(a.patient_phone) = public.phone_key(p_phone)
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
  p_appointment_id uuid,
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
  where a.id = p_appointment_id
    and a.clinic_id = p_clinic_id
    and length(public.phone_key(p_phone)) >= 8
    and public.phone_key(a.patient_phone) = public.phone_key(p_phone)
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

-- New functions default to no execute for clients (default privileges); grant the backend.
revoke execute on function public.find_appointments_by_phone(uuid, text) from public, anon, authenticated;
revoke execute on function public.cancel_appointment(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.reschedule_appointment(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.find_appointments_by_phone(uuid, text) to service_role;
grant execute on function public.cancel_appointment(uuid, uuid, text) to service_role;
grant execute on function public.reschedule_appointment(uuid, uuid, text, timestamptz) to service_role;
