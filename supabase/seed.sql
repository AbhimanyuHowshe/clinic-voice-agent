-- Fictional demo data: one clinic in India, one in Australia. No real people or patients.
-- Safe to rerun: clinics and doctors are upserted; schedules, FAQs and agent windows replaced.
-- Remote: npx supabase db push --include-seed

insert into public.clinics (slug, name, timezone, country, phone, address, voice_language) values
  ('sanjeevani', 'Sanjeevani Demo Clinic', 'Asia/Kolkata', 'IN', '+912000000000',
   '12 MG Road, Pune (fictional)', 'hi-IN'),
  ('harbourside', 'Harbourside Demo Medical Centre', 'Australia/Sydney', 'AU', '+61200000000',
   '5 Harbour Street, Sydney (fictional)', 'en-IN')
on conflict (slug) do update set
  name = excluded.name, timezone = excluded.timezone, country = excluded.country,
  phone = excluded.phone, address = excluded.address, voice_language = excluded.voice_language;

-- Doctors: (clinic slug, name, specialty, slot minutes, weekdays, [start, end] windows)
drop table if exists seed_doctors;
create temporary table seed_doctors (
  slug text, name text, specialty text, slot_minutes int, weekdays int[], windows text[][]
);
insert into seed_doctors values
  ('sanjeevani', 'Dr. Anjali Sharma', 'General Physician', 15, '{1,2,3,4,5,6}',
   '{{09:00,13:00},{17:00,20:00}}'),
  ('sanjeevani', 'Dr. Rohan Mehta', 'Pediatrician', 20, '{1,3,5}', '{{10:00,14:00}}'),
  ('sanjeevani', 'Dr. Kavita Rao', 'Dermatologist', 20, '{2,4,6}', '{{11:00,15:00}}'),
  ('harbourside', 'Dr. Emily Carter', 'General Practitioner', 15, '{1,2,3,4,5}',
   '{{08:30,12:30},{13:30,17:00}}'),
  ('harbourside', 'Dr. James Nguyen', 'General Practitioner', 15, '{1,3,5,6}', '{{09:00,13:00}}');

insert into public.doctors (clinic_id, name, specialty, slot_minutes, active)
select c.id, s.name, s.specialty, s.slot_minutes, true
from seed_doctors s join public.clinics c on c.slug = s.slug
on conflict (clinic_id, name) do update set
  specialty = excluded.specialty, slot_minutes = excluded.slot_minutes, active = true;

delete from public.doctor_schedules ds
using public.doctors d, public.clinics c, seed_doctors s
where ds.doctor_id = d.id and d.clinic_id = c.id and c.slug = s.slug and d.name = s.name;

insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time)
select d.id, wd, s.windows[i][1]::time, s.windows[i][2]::time
from seed_doctors s
join public.clinics c on c.slug = s.slug
join public.doctors d on d.clinic_id = c.id and d.name = s.name
cross join unnest(s.weekdays) as wd
cross join generate_subscripts(s.windows, 1) as i;

-- FAQs
delete from public.clinic_faqs f using public.clinics c
where f.clinic_id = c.id and c.slug in ('sanjeevani', 'harbourside');

insert into public.clinic_faqs (clinic_id, question, answer)
select c.id, q, a from public.clinics c
join (values
  ('sanjeevani', 'What are the clinic timings?',
   'Monday to Saturday, 9 AM to 1 PM and 5 PM to 8 PM. Closed on Sundays.'),
  ('sanjeevani', 'What is the consultation fee?',
   'General physician 500 rupees, pediatrician 600 rupees, dermatologist 800 rupees.'),
  ('sanjeevani', 'Where is the clinic?',
   '12 MG Road, Pune, near the city bus stand. Parking is available.'),
  ('sanjeevani', 'Do you accept insurance or cashless?',
   'We do not offer cashless insurance. We give a bill you can claim from your insurer.'),
  ('sanjeevani', 'How can I pay?', 'Cash, UPI and cards are accepted at the reception.'),
  ('sanjeevani', 'Do you do blood tests?',
   'Yes, sample collection is from 8 AM to 11 AM, Monday to Saturday. Some tests need fasting.'),
  ('sanjeevani', 'Do you offer home visits?', 'No, we do not offer home visits.'),
  ('harbourside', 'What are your opening hours?',
   'Monday to Friday 8:30 AM to 5 PM, Saturday 9 AM to 1 PM. Closed Sundays and public holidays.'),
  ('harbourside', 'Do you bulk bill?',
   'We bulk bill children under 16 and concession card holders. A standard consult is 95 dollars, with a Medicare rebate.'),
  ('harbourside', 'Where are you located?',
   '5 Harbour Street, Sydney, two minutes from the ferry wharf.'),
  ('harbourside', 'Do you offer telehealth?', 'Yes, telehealth consults are available for existing patients.')
) as v(slug, q, a) on v.slug = c.slug;

-- Agent operating windows (the schedule only applies when schedule_enabled is true).
delete from public.agent_schedules w using public.clinics c
where w.clinic_id = c.id and c.slug in ('sanjeevani', 'harbourside');

insert into public.agent_schedules (clinic_id, weekday, start_time, end_time)
select c.id, wd, '08:00', '21:00'
from public.clinics c cross join generate_series(1, 6) wd where c.slug = 'sanjeevani';
insert into public.agent_schedules (clinic_id, weekday, start_time, end_time)
select c.id, wd, '07:00', '22:00'
from public.clinics c cross join generate_series(0, 6) wd where c.slug = 'harbourside';

drop table seed_doctors;
