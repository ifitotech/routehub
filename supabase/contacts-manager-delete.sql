-- Run in Supabase SQL Editor. Managers and CEO can delete contacts;
-- other roles retain read/create access only.
drop policy if exists "managers delete contacts" on contacts;
create policy "managers delete contacts" on contacts
for delete to authenticated
using (exists (
  select 1 from company_users cu
  where cu.company_id = contacts.company_id
    and cu.user_id = auth.uid()
    and cu.role in ('branch_manager','operations_manager')
)) or exists (
  select 1 from platform_admins pa where pa.user_id = auth.uid()
));
