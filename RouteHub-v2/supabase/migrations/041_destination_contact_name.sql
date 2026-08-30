-- Optional person at this stop. Defaults from contacts.contact_name.
alter table public.routes
  add column if not exists destination_contact_name text;
