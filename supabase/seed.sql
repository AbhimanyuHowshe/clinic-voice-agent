-- Demo data. India: Dr. Singh Dental Clinic, Ujjain, from its public website drgovindsingh.com
-- (checked 2026-10-24); it keeps the old internal slug 'sanjeevani' so staff logins and links
-- still work. Doctor slot lengths and the agent's hours are demo assumptions, not from the site.
-- Australia: a fictional clinic. No real patients.
-- Safe to rerun: clinics and doctors are upserted; schedules, FAQs and agent windows replaced.
-- Remote: npx supabase db push --include-seed

insert into public.clinics (slug, name, timezone, country, phone, address, voice_language) values
  ('sanjeevani', 'Dr. Singh Dental Clinic', 'Asia/Kolkata', 'IN', '+917771818143',
   'First Floor, Mahakal Sampanna Complex, Near Tower, Freeganj, Madhav Nagar, Ujjain, Madhya Pradesh 456010',
   'hi-IN'),
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
  ('sanjeevani', 'Dr. Govind Singh', 'Dentist', 30, '{1,2,3,4,5,6}', '{{11:00,19:00}}'),
  ('sanjeevani', 'Dr. Preeti Singh', 'Dentist', 30, '{1,2,3,4,5,6}', '{{11:00,19:00}}'),
  ('harbourside', 'Dr. Emily Carter', 'General Practitioner', 15, '{1,2,3,4,5}',
   '{{08:30,12:30},{13:30,17:00}}'),
  ('harbourside', 'Dr. James Nguyen', 'General Practitioner', 15, '{1,3,5,6}', '{{09:00,13:00}}');

insert into public.doctors (clinic_id, name, specialty, slot_minutes, active)
select c.id, s.name, s.specialty, s.slot_minutes, true
from seed_doctors s join public.clinics c on c.slug = s.slug
on conflict (clinic_id, name) do update set
  specialty = excluded.specialty, slot_minutes = excluded.slot_minutes, active = true;

-- Doctors no longer in the seed are switched off rather than deleted, because past
-- appointments may still reference them. (The old fictional Sanjeevani doctors and their
-- bookings were deleted by hand on 2026-10-25.)
update public.doctors d set active = false
from public.clinics c
where d.clinic_id = c.id and c.slug in ('sanjeevani', 'harbourside')
  and not exists (select 1 from seed_doctors s where s.slug = c.slug and s.name = d.name);

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
  ('harbourside', 'What are your opening hours?',
   'Monday to Friday 8:30 AM to 5 PM, Saturday 9 AM to 1 PM. Closed Sundays and public holidays.'),
  ('harbourside', 'Do you bulk bill?',
   'We bulk bill children under 16 and concession card holders. A standard consult is 95 dollars, with a Medicare rebate.'),
  ('harbourside', 'Where are you located?',
   '5 Harbour Street, Sydney, two minutes from the ferry wharf.'),
  ('harbourside', 'Do you offer telehealth?', 'Yes, telehealth consults are available for existing patients.'),
  ('sanjeevani', 'What are the clinic timings?',
   'Monday to Saturday, 11 AM to 7 PM. Closed on Sundays.'),
  ('sanjeevani', 'Where is the clinic?',
   'First Floor, Mahakal Sampanna Complex, near Tower, Freeganj, Madhav Nagar, Ujjain, Madhya Pradesh 456010.'),
  ('sanjeevani', 'What is the clinic phone number or email?',
   'Phone and WhatsApp 7 7 7 1 8, 1 8 1 4 3. Email drgovindsingh@rediffmail.com.'),
  ('sanjeevani', 'Who are the doctors?',
   'Dr. Govind Singh and Dr. Preeti Singh, both BDS dentists with more than 25 years of experience and members of the Indian Dental Association.'),
  ('sanjeevani', 'What is Dr. Govind Singh''s expertise?',
   'General and family dentistry, root canal treatment, teeth whitening and smile makeovers.'),
  ('sanjeevani', 'What is Dr. Preeti Singh''s expertise?',
   'Root canal treatment, cosmetic dentistry and preventive dental care.'),
  ('sanjeevani', 'Which treatments do you offer?',
   'Dental checkups, teeth cleaning, fillings, root canal treatment, tooth extraction, wisdom tooth removal, teeth whitening, veneers, braces, Invisalign clear aligners, smile makeovers and emergency dental care.'),
  ('sanjeevani', 'Do you handle dental emergencies?',
   'Yes. Severe tooth pain, broken or knocked-out teeth and dental injuries are treated as priority. Please call the clinic on 7 7 7 1 8, 1 8 1 4 3.'),
  ('sanjeevani', 'What is a root canal treatment?',
   'It removes infected or inflamed tissue inside a tooth to relieve pain and save the tooth instead of extracting it. The dentist decides if you need it after an examination.'),
  ('sanjeevani', 'Do you offer braces or clear aligners?',
   'Yes, both metal braces and Invisalign clear removable aligners, to straighten teeth and correct gaps, crowding and bite problems.'),
  ('sanjeevani', 'Do you do teeth whitening?',
   'Yes, professional dentist-supervised whitening for stains from tea, coffee and everyday wear.'),
  ('sanjeevani', 'Do you have digital X-ray?',
   'Yes, the clinic has digital X-rays and modern dental chairs.'),
  ('sanjeevani', 'How do you keep instruments clean?',
   'Instruments are sterilised under strict clinical protocols, and single-use disposables are used where applicable.'),
  ('sanjeevani', 'How can I book an appointment?',
   'I can book it for you now on this call. You can also call or WhatsApp 7 7 7 1 8, 1 8 1 4 3, or use the appointment form on the clinic website.')
) as v(slug, q, a) on v.slug = c.slug;

-- Agent operating windows (the schedule only applies when schedule_enabled is true).
delete from public.agent_schedules w using public.clinics c
where w.clinic_id = c.id and c.slug in ('sanjeevani', 'harbourside');

insert into public.agent_schedules (clinic_id, weekday, start_time, end_time)
select c.id, wd, '07:00', '22:00'
from public.clinics c cross join generate_series(0, 6) wd where c.slug = 'harbourside';
insert into public.agent_schedules (clinic_id, weekday, start_time, end_time)
select c.id, wd, '08:00', '21:00'
from public.clinics c cross join generate_series(1, 6) wd where c.slug = 'sanjeevani';

-- Welcome line spoken word for word (Harbourside lets the model greet).
update public.clinics set greeting =
  'Namaste! Welcome to Dr. Govind Singh''s Dental Clinic, Ujjain. How may I help you today? आप हिंदी में भी बात कर सकते हैं।'
where slug = 'sanjeevani';

drop table seed_doctors;
