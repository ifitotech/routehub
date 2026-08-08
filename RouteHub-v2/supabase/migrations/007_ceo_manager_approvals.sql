-- CEO-controlled authorization for a company's first Manager.
create table if not exists public.platform_manager_approvals (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company_name text not null,
  status text not null default 'pending',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint platform_manager_approvals_email_unique unique (email)
);
alter table public.platform_manager_approvals enable row level security;
drop policy if exists "ceo manages manager approvals" on public.platform_manager_approvals;
create policy "ceo manages manager approvals" on public.platform_manager_approvals for all to authenticated using (exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid())) with check (exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid()));
drop policy if exists "manager reads own approval" on public.platform_manager_approvals;
create policy "manager reads own approval" on public.platform_manager_approvals for select to authenticated using (lower(email)=lower((select email from auth.users where id=auth.uid())));
create index if not exists platform_manager_approvals_status_idx on public.platform_manager_approvals(status);
