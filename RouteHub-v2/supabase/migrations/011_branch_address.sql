-- RouteHub: editable branch addresses.
-- Safe to run more than once; existing branches keep their current data.
alter table public.branches
  add column if not exists address text;

comment on column public.branches.address is
  'Full street address used as a route starting point; editable by authorized managers.';

alter table public.branches enable row level security;

drop policy if exists "members read own branches" on public.branches;
create policy "members read own branches" on public.branches
  for select to authenticated
  using (exists (
    select 1 from public.company_users cu
    where cu.company_id = branches.company_id and cu.user_id = auth.uid()
  ));

drop policy if exists "managers manage own branches" on public.branches;
create policy "managers manage own branches" on public.branches
  for all to authenticated
  using (exists (
    select 1 from public.company_users cu
    where cu.company_id = branches.company_id
      and cu.user_id = auth.uid()
      and cu.role in ('branch_manager', 'operations_manager')
  ))
  with check (exists (
    select 1 from public.company_users cu
    where cu.company_id = branches.company_id
      and cu.user_id = auth.uid()
      and cu.role in ('branch_manager', 'operations_manager')
  ));
