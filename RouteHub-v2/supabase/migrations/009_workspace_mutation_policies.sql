-- Complete the Manager/Operations mutation workflow for contacts and requests.
-- Additive and safe to run more than once after the base RouteHub schema.

alter table public.contacts enable row level security;
alter table public.requests enable row level security;

drop policy if exists "edit contacts by role" on public.contacts;
create policy "edit contacts by role" on public.contacts for update to authenticated
using (exists (select 1 from public.company_users cu where cu.company_id=contacts.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager')))
with check (exists (select 1 from public.company_users cu where cu.company_id=contacts.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager')));

drop policy if exists "delete contacts by manager" on public.contacts;
create policy "delete contacts by manager" on public.contacts for delete to authenticated
using (exists (select 1 from public.company_users cu where cu.company_id=contacts.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager')));

drop policy if exists "edit requests by role" on public.requests;
create policy "edit requests by role" on public.requests for update to authenticated
using (exists (select 1 from public.company_users cu where cu.company_id=requests.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager','sales_representative')))
with check (exists (select 1 from public.company_users cu where cu.company_id=requests.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager','sales_representative')));
