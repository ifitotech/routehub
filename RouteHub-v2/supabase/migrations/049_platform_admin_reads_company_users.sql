-- Admin > Companies has always shown "0 team members" for every company,
-- no matter how many real members it has. The root cause: company_users'
-- only SELECT policy (020_sync_team_members_and_route_drivers.sql) scopes
-- to "your own row, or a company you belong to" - a platform admin (CEO)
-- isn't a member of any customer's company, so RLS silently returned zero
-- rows for the admin's member-count query. Every other platform_* table
-- (app_error_reports, support_requests, platform_audit_events) already
-- grants platform_admins a read policy; company_users never got one.

drop policy if exists "platform admins read company_users" on public.company_users;
create policy "platform admins read company_users" on public.company_users
  for select to authenticated
  using (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()));
