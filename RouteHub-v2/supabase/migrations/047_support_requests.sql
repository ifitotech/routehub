-- "Contact support" in Settings only showed a fake "request ready" message
-- and sent nothing anywhere - there was no way for a real request to reach
-- the CEO. This table plus the Admin > Support screen closes that loop.
-- A support_requests table may already exist from earlier, unmigrated work
-- with a different shape - complete it with alter statements instead of
-- assuming create table if not exists ran the full definition below.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid()
);
alter table public.support_requests add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.support_requests add column if not exists user_id uuid references public.users(id) on delete set null;
alter table public.support_requests add column if not exists message text;
update public.support_requests set message = coalesce(message, '') where message is null;
alter table public.support_requests alter column message set not null;
alter table public.support_requests add column if not exists status text not null default 'open';
alter table public.support_requests add column if not exists resolved_by uuid references public.users(id) on delete set null;
alter table public.support_requests add column if not exists resolved_at timestamptz;
alter table public.support_requests add column if not exists created_at timestamptz not null default now();

create index if not exists support_requests_status_idx on public.support_requests(status);
create index if not exists support_requests_created_idx on public.support_requests(created_at desc);

alter table public.support_requests enable row level security;

drop policy if exists "members submit their own support requests" on public.support_requests;
create policy "members submit their own support requests" on public.support_requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "members read their own support requests" on public.support_requests;
create policy "members read their own support requests" on public.support_requests
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "platform admins manage support requests" on public.support_requests;
create policy "platform admins manage support requests" on public.support_requests
  for all to authenticated
  using (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()));
