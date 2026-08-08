-- Run in Supabase after creating a private bucket named route-evidence.
insert into storage.buckets (id,name,public)
values ('route-evidence','route-evidence',false)
on conflict (id) do update set public=false;

drop policy if exists "route evidence read by company" on storage.objects;
create policy "route evidence read by company" on storage.objects for select to authenticated using (bucket_id='route-evidence' and exists(select 1 from public.company_users cu where cu.company_id=split_part(name,'/',1)::uuid and cu.user_id=auth.uid()));

drop policy if exists "route evidence upload by member" on storage.objects;
create policy "route evidence upload by member" on storage.objects for insert to authenticated with check (bucket_id='route-evidence' and exists(select 1 from public.company_users cu where cu.company_id=split_part(name,'/',1)::uuid and cu.user_id=auth.uid()));
