-- Row Level Security and grants (least privilege).
-- anon: nothing. authenticated staff: their own clinic only; admins manage settings.
-- service_role (voice agent backend): full table access plus the booking functions.

do $$
declare t text;
begin
  foreach t in array array[
    'clinics', 'profiles', 'doctors', 'doctor_schedules', 'clinic_holidays', 'clinic_faqs',
    'appointments', 'agent_settings', 'agent_schedules', 'temporary_pauses', 'call_logs', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;
grant usage, select on all sequences in schema public to service_role;

-- Read access for clinic members.
grant select on public.clinics, public.profiles, public.doctors, public.doctor_schedules,
  public.clinic_holidays, public.clinic_faqs, public.appointments, public.agent_settings,
  public.agent_schedules, public.temporary_pauses, public.call_logs, public.audit_logs
  to authenticated;

create policy clinics_member_read on public.clinics for select to authenticated
  using (public.is_clinic_member(id));
create policy profiles_member_read on public.profiles for select to authenticated
  using (public.is_clinic_member(clinic_id));

do $$
declare t text;
begin
  foreach t in array array[
    'clinic_holidays', 'clinic_faqs', 'appointments', 'agent_settings', 'agent_schedules',
    'temporary_pauses', 'call_logs', 'doctors'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_clinic_member(clinic_id))',
      t || '_member_read', t);
  end loop;
end;
$$;

create policy doctor_schedules_member_read on public.doctor_schedules for select to authenticated
  using (exists (
    select 1 from public.doctors d where d.id = doctor_id and public.is_clinic_member(d.clinic_id)
  ));

-- Audit logs: admins only.
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (public.is_clinic_admin(clinic_id));

-- Admin-managed configuration.
grant insert, update, delete on public.doctors, public.doctor_schedules, public.clinic_holidays,
  public.clinic_faqs, public.agent_schedules, public.temporary_pauses to authenticated;
grant update (manual_enabled, schedule_enabled, fallback_mode, fallback_message,
  transfer_number, ongoing_call_policy, updated_by) on public.agent_settings to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'doctors', 'clinic_holidays', 'clinic_faqs', 'agent_schedules', 'temporary_pauses', 'agent_settings'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_clinic_admin(clinic_id)) with check (public.is_clinic_admin(clinic_id))',
      t || '_admin_write', t);
  end loop;
end;
$$;

create policy doctor_schedules_admin_write on public.doctor_schedules for all to authenticated
  using (exists (
    select 1 from public.doctors d where d.id = doctor_id and public.is_clinic_admin(d.clinic_id)
  ))
  with check (exists (
    select 1 from public.doctors d where d.id = doctor_id and public.is_clinic_admin(d.clinic_id)
  ));

-- Pauses: any staff member may pause the agent (an operational safety action).
create policy temporary_pauses_staff_insert on public.temporary_pauses for insert to authenticated
  with check (public.is_clinic_member(clinic_id));

-- Staff may change appointment status (cancel, complete, no-show) but not times or patients.
grant update (status) on public.appointments to authenticated;
create policy appointments_staff_update on public.appointments for update to authenticated
  using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

-- Staff may mark call follow-ups done.
grant update (follow_up_done) on public.call_logs to authenticated;
create policy call_logs_staff_update on public.call_logs for update to authenticated
  using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

-- Functions: revoke the default PUBLIC execute, then grant narrowly.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.agent_effective_state(uuid, timestamptz) to authenticated;
grant execute on function public.is_clinic_member(uuid) to authenticated;
grant execute on function public.is_clinic_admin(uuid) to authenticated;
-- Trigger functions run as their owner; RLS helpers used inside policies need execute.
grant execute on function public.is_valid_timezone(text) to authenticated;
grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.audit_change() to authenticated;
grant execute on function public.create_agent_settings() to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
