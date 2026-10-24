# Supabase

| File | Contents |
|---|---|
| `migrations/…01_core_schema.sql` | Tables, double-booking exclusion constraint, audit triggers (patient details stripped) |
| `migrations/…02_functions.sql` | `agent_effective_state`, `available_slots`, `book_appointment` (idempotent), `find/cancel/reschedule_appointment` |
| `migrations/…03_rls_and_grants.sql` | RLS: members read their clinic, admins change config; booking functions are service-role only |
| `migrations/…04_doctor_name_unique.sql` | One doctor name per clinic |
| `migrations/…05_phone_verification.sql` | Patients find, cancel and move appointments by phone number (no reference number) |
| `seed.sql` | Demo clinics: Dr. Singh Dental Clinic, Ujjain (from drgovindsingh.com) and a fictional Sydney clinic, with doctors, hours and FAQs |

Availability precedence (computed in the database, clinic time zone): manual OFF → holiday → temporary
pause → agent schedule (only when `schedule_enabled`) → available. Windows whose end is before their
start run overnight.

Apply to the linked project:

```
npx supabase db push                 # migrations
npx supabase db push --include-seed  # migrations + demo data (safe to rerun)
# If seed.sql changed after it was first applied, db push only records its new hash. Re-run it:
npx supabase db query --linked -f supabase/seed.sql
```
