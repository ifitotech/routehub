-- public.users had row level security ENABLED with ZERO policies for any
-- command. In Postgres that means default-deny: nobody (not even the CEO)
-- could SELECT or UPDATE this table through the API at all. Embedded joins
-- like users(email,name) in Admin > Errors/Support silently returned null
-- for the relation instead of erroring, so rows rendered as "Unknown user"
-- with nothing to expand - and, more seriously, two real UPDATE call sites
-- have been no-ops this whole time with no error surfaced:
--   - app/driver-v3/more/page.tsx: a driver saving their own profile name
--   - app/manager/team/page.tsx: a manager editing a teammate's name/email
-- Both looked like they worked (Supabase returns success with 0 rows
-- affected when RLS blocks an update) but never actually persisted to
-- public.users, only to auth.users' metadata via auth.updateUser().

drop policy if exists "users read own row" on public.users;
create policy "users read own row" on public.users
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "users read company teammates" on public.users;
create policy "users read company teammates" on public.users
  for select to authenticated
  using (
    exists (
      select 1 from public.company_users mine
      join public.company_users theirs on theirs.company_id = mine.company_id
      where mine.user_id = auth.uid() and theirs.user_id = users.id
    )
  );

drop policy if exists "platform admins read users" on public.users;
create policy "platform admins read users" on public.users
  for select to authenticated
  using (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()));

drop policy if exists "users update own row" on public.users;
create policy "users update own row" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Managers (the same roles already allowed to create/revoke invitations)
-- editing a teammate's profile from Team > Edit.
drop policy if exists "managers update teammate profile" on public.users;
create policy "managers update teammate profile" on public.users
  for update to authenticated
  using (
    exists (
      select 1 from public.company_users mine
      join public.company_users theirs on theirs.company_id = mine.company_id
      where mine.user_id = auth.uid()
        and mine.role in ('branch_manager', 'operations_manager')
        and theirs.user_id = users.id
    )
  )
  with check (
    exists (
      select 1 from public.company_users mine
      join public.company_users theirs on theirs.company_id = mine.company_id
      where mine.user_id = auth.uid()
        and mine.role in ('branch_manager', 'operations_manager')
        and theirs.user_id = users.id
    )
  );

drop policy if exists "platform admins manage users" on public.users;
create policy "platform admins manage users" on public.users
  for all to authenticated
  using (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()));
