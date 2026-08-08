-- Manager workspace support. Safe to run more than once.
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  email text not null,
  role text not null,
  status text not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists invitations_company_idx on public.invitations(company_id, status);
alter table public.invitations enable row level security;
drop policy if exists "members read company invitations" on public.invitations;
create policy "members read company invitations" on public.invitations for select to authenticated using (exists (select 1 from public.company_users cu where cu.company_id=invitations.company_id and cu.user_id=auth.uid()));
drop policy if exists "managers create company invitations" on public.invitations;
create policy "managers create company invitations" on public.invitations for insert to authenticated with check (created_by=auth.uid() and exists (select 1 from public.company_users cu where cu.company_id=invitations.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager')));
drop policy if exists "managers revoke company invitations" on public.invitations;
create policy "managers revoke company invitations" on public.invitations for update to authenticated using (exists (select 1 from public.company_users cu where cu.company_id=invitations.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager')));
