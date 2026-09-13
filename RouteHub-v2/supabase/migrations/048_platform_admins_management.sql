-- platform_admins already exists (it gates every /admin page) but was never
-- tracked in a local migration and had no way to manage it except editing
-- rows straight in the Supabase dashboard - there was no way to add a
-- co-admin, or even see who has CEO access, from inside the app.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.platform_admins add column if not exists created_at timestamptz not null default now();

alter table public.platform_admins enable row level security;

drop policy if exists "platform admins manage platform admins" on public.platform_admins;
create policy "platform admins manage platform admins" on public.platform_admins
  for all to authenticated
  using (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()));
