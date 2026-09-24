-- CEO/Admin needs a platform-wide, read-only operational view. Routes already
-- have RLS enabled; this adds only a SELECT exception for members explicitly
-- recorded as platform admins. It does not grant route creation, assignment,
-- editing, completion, or evidence access through a new write policy.

drop policy if exists "platform admins read routes" on public.routes;
create policy "platform admins read routes"
on public.routes
for select
to authenticated
using (
  exists (
    select 1
    from public.platform_admins admin
    where admin.user_id = (select auth.uid())
  )
);
