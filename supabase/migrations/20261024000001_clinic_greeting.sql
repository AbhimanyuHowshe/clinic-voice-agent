-- Optional fixed welcome line per clinic. When set, the agent speaks it word for word at the
-- start of a call; when null, the model writes a short greeting with the clinic name.
alter table public.clinics
  add column greeting text check (greeting is null or length(greeting) between 5 and 500);
