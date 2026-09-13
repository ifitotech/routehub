-- app_error_reports already exists (034) and captures errors scoped to a
-- company (readable by that company's own members) - CEO/Admin had no way
-- to see errors across every company, which is the whole point of a
-- platform-wide "Errors" screen. Adds the missing admin policy plus the
-- resolved/open workflow the Admin UI needs.
alter table public.app_error_reports add column if not exists resolved_by uuid references public.users(id) on delete set null;

drop policy if exists "platform admins manage app error reports" on public.app_error_reports;
create policy "platform admins manage app error reports" on public.app_error_reports
  for all to authenticated
  using (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()));
