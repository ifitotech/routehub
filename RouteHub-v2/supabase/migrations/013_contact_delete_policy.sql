-- RouteHub: allow authorized branch and operations managers to delete contacts
-- only inside their own company. Safe to run more than once.
alter table public.contacts enable row level security;

drop policy if exists "delete contacts by manager" on public.contacts;
create policy "delete contacts by manager"
on public.contacts
for delete
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = contacts.company_id
      and cu.user_id = auth.uid()
      and cu.role in ('branch_manager', 'operations_manager')
  )
);

notify pgrst, 'reload schema';
