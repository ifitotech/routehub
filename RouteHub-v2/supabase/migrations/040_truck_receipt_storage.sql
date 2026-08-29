-- Storage access for truck receipts. Existing route evidence paths remain unchanged.
create policy "Members can view truck receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'route-evidence'
  and (storage.foldername(name))[1] = 'truck-receipts'
  and exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id::text = (storage.foldername(name))[2]
      and (cu.branch_id is null or cu.branch_id::text = (storage.foldername(name))[3])
  )
);

create policy "Drivers and managers can upload truck receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'route-evidence'
  and (storage.foldername(name))[1] = 'truck-receipts'
  and exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id::text = (storage.foldername(name))[2]
      and cu.role in ('driver','branch_manager','operations_manager')
      and (cu.branch_id is null or cu.branch_id::text = (storage.foldername(name))[3])
  )
);
