-- Lets the CEO see the phone number a tester has on file (name already
-- syncs to public.users; phone never did) and the password an Admin-created
-- beta account was given - only ever the one the CEO set, never a password
-- the tester later chose themselves from their own Settings (that's
-- one-way hashed the instant they change it, same as everyone else's).
alter table public.users add column if not exists phone text;

create table if not exists public.beta_account_credentials (
  user_id uuid primary key references public.users(id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);
alter table public.beta_account_credentials enable row level security;

drop policy if exists "platform admins manage beta credentials" on public.beta_account_credentials;
create policy "platform admins manage beta credentials" on public.beta_account_credentials
  for all to authenticated
  using (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()));
