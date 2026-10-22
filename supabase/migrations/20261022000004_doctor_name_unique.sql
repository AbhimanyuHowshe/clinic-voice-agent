-- Lets the demo seed upsert doctors by name, and stops duplicate doctor entries per clinic.
alter table public.doctors add constraint doctors_clinic_name_key unique (clinic_id, name);
