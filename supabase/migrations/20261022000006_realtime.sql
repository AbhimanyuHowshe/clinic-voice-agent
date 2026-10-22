-- Let the staff dashboard receive live changes. Supabase Realtime applies each table's RLS
-- policies, so staff only receive rows from their own clinic.
alter publication supabase_realtime add table
  public.appointments,
  public.call_logs,
  public.agent_settings,
  public.temporary_pauses;
