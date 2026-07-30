insert into storage.buckets (id,name,public) values ('routehub-evidence','routehub-evidence',false) on conflict (id) do nothing;

create policy "company members upload evidence" on storage.objects for insert to authenticated with check (bucket_id='routehub-evidence' and exists (select 1 from company_users cu where cu.user_id=auth.uid()));
create policy "company members read evidence" on storage.objects for select to authenticated using (bucket_id='routehub-evidence' and exists (select 1 from company_users cu where cu.user_id=auth.uid()));
create policy "owners delete evidence" on storage.objects for delete to authenticated using (bucket_id='routehub-evidence' and owner_id=auth.uid()::text);
