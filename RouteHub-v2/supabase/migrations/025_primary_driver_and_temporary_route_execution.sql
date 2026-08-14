-- RouteHub beta operating model:
--   one default/primary driver per branch, with occasional temporary route
--   execution by an explicitly assigned team member.
--
-- This migration is additive. It does not change company_users.role and it
-- stores only the latest operational coordinate in driving_sessions.

alter table public.branches
  add column if not exists primary_driver_id uuid references public.users(id) on delete set null;

create index if not exists branches_primary_driver_idx
  on public.branches(primary_driver_id)
  where primary_driver_id is not null;

comment on column public.branches.primary_driver_id is
  'Default permanent driver for new routes at this branch. Temporary route assignees remain regular team members.';

create or replace function public.validate_branch_primary_driver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.primary_driver_id is not null and not exists (
    select 1
    from public.company_users member
    where member.company_id = new.company_id
      and member.user_id = new.primary_driver_id
      and member.role = 'driver'
      and (member.branch_id is null or member.branch_id = new.id)
  ) then
    raise exception 'Primary driver must be a Driver member of this branch.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_branch_primary_driver on public.branches;
create trigger validate_branch_primary_driver
before insert or update of primary_driver_id, company_id on public.branches
for each row execute function public.validate_branch_primary_driver();

-- Keep the branch default valid if a Driver is removed, moved to another
-- branch, or given a different permanent role. Existing routes are untouched.
create or replace function public.clear_invalid_branch_primary_driver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.branches branch
  set primary_driver_id = null
  where branch.company_id = old.company_id
    and branch.primary_driver_id = old.user_id
    and not exists (
      select 1
      from public.company_users member
      where member.company_id = branch.company_id
        and member.user_id = branch.primary_driver_id
        and member.role = 'driver'
        and (member.branch_id is null or member.branch_id = branch.id)
    );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_invalid_branch_primary_driver on public.company_users;
drop trigger if exists clear_invalid_branch_primary_driver_on_delete on public.company_users;
create trigger clear_invalid_branch_primary_driver
after update of role, branch_id, company_id on public.company_users
for each row execute function public.clear_invalid_branch_primary_driver();
create trigger clear_invalid_branch_primary_driver_on_delete
after delete on public.company_users
for each row execute function public.clear_invalid_branch_primary_driver();

-- A driving_day belongs to a permanent Driver. A temporary_route session is
-- tied to exactly one assigned route and ends with that route.
alter table public.driving_sessions
  add column if not exists session_kind text not null default 'driving_day';
alter table public.driving_sessions
  add column if not exists route_id uuid references public.routes(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.driving_sessions'::regclass
      and conname = 'driving_sessions_kind_check'
  ) then
    alter table public.driving_sessions
      add constraint driving_sessions_kind_check
      check (session_kind in ('driving_day','temporary_route'));
  end if;
end;
$$;

create index if not exists driving_sessions_route_idx
  on public.driving_sessions(route_id)
  where route_id is not null;

comment on column public.driving_sessions.session_kind is
  'driving_day for permanent drivers; temporary_route for one-off team coverage.';
comment on column public.driving_sessions.route_id is
  'Assigned route that authorizes a temporary operational location session. Null for normal driving days.';

-- End active legacy full-day sessions owned by non-Drivers. The audit row is
-- preserved, but all future team-member sessions must reference one route.
update public.driving_sessions session
set status = 'ended',
    ended_at = coalesce(session.ended_at, now()),
    last_updated_at = now()
where session.status = 'active'
  and session.session_kind = 'driving_day'
  and not exists (
    select 1
    from public.company_users member
    where member.company_id = session.company_id
      and member.user_id = session.driver_id
      and member.role = 'driver'
      and (member.branch_id is null or session.branch_id is null or member.branch_id = session.branch_id)
  );

-- Assigned execution remains scoped to the authenticated user, their company,
-- and their branch. It does not grant permission over another member's route.
drop policy if exists "drivers update assigned routes" on public.routes;
drop policy if exists "assigned members execute own routes" on public.routes;
create policy "assigned members execute own routes"
on public.routes
for update
to authenticated
using (
  driver_id = auth.uid()
  and exists (
    select 1
    from public.company_users member
    where member.user_id = auth.uid()
      and member.company_id = routes.company_id
      and member.role in ('driver','branch_manager','operations_manager','sales_representative','counter_sales')
      and (member.branch_id is null or routes.branch_id is null or member.branch_id = routes.branch_id)
  )
)
with check (
  driver_id = auth.uid()
  and exists (
    select 1
    from public.company_users member
    where member.user_id = auth.uid()
      and member.company_id = routes.company_id
      and member.role in ('driver','branch_manager','operations_manager','sales_representative','counter_sales')
      and (member.branch_id is null or routes.branch_id is null or member.branch_id = routes.branch_id)
  )
);

-- The existing route update trigger remains the field-level guard. Drivers
-- and Counter may update only execution/evidence fields; dispatch-capable
-- permanent roles retain only the broader permissions they already had.
create or replace function public.enforce_assigned_driver_route_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_dispatch boolean;
  allowed_columns text[] := array[
    'status','updated_version','completed_at','completion_lat','completion_lng',
    'completion_accuracy','completion_distance_m','completion_method',
    'completion_warning','completion_photo_path','notes','driver_confirmed_at'
  ];
begin
  if actor is null or old.driver_id is distinct from actor then return new; end if;
  select exists (
    select 1 from public.company_users member
    where member.user_id = actor
      and member.company_id = old.company_id
      and member.role in ('branch_manager','operations_manager','sales_representative')
  ) into actor_is_dispatch;
  if actor_is_dispatch then return new; end if;
  if (to_jsonb(new) - allowed_columns) is distinct from (to_jsonb(old) - allowed_columns) then
    raise exception 'Assigned members may only update route progress, evidence, location, and issue notes.'
      using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (
    (old.status in ('draft','pending','published') and new.status = 'active')
    or (old.status = 'active' and new.status in ('paused','completed','issue'))
    or (old.status = 'paused' and new.status in ('active','completed','issue'))
    or (old.status = 'issue' and new.status = 'completed')
  ) then
    raise exception 'Invalid assigned route status transition: % to %.', old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_driving_session_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.company_id is distinct from old.company_id
    or new.branch_id is distinct from old.branch_id
    or new.driver_id is distinct from old.driver_id
    or new.session_kind is distinct from old.session_kind
    or new.route_id is distinct from old.route_id
    or new.started_at is distinct from old.started_at
  ) then
    raise exception 'Driving session ownership and scope cannot be changed.' using errcode = '42501';
  end if;

  -- Ending a valid session is always allowed for its existing scope. This is
  -- required both for an explicit End Driving Day and for the route-status
  -- trigger that closes a one-off session after completion/issue/cancellation.
  if tg_op = 'UPDATE'
     and old.status = 'active'
     and new.status = 'ended' then
    return new;
  end if;

  if new.session_kind = 'driving_day' then
    if new.route_id is not null then
      raise exception 'A driving day cannot be tied to one route.' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.company_users member
      where member.company_id = new.company_id
        and member.user_id = new.driver_id
        and member.role = 'driver'
        and (member.branch_id is null or new.branch_id is null or member.branch_id = new.branch_id)
    ) then
      raise exception 'Only a permanent Driver may start a driving day.' using errcode = '42501';
    end if;
  elsif new.session_kind = 'temporary_route' then
    if new.route_id is null or not exists (
      select 1
      from public.routes route
      join public.company_users member
        on member.company_id = route.company_id
       and member.user_id = route.driver_id
      where route.id = new.route_id
        and route.company_id = new.company_id
        and route.driver_id = new.driver_id
        and route.status in ('active','paused')
        and (route.branch_id is not distinct from new.branch_id)
        and member.role in ('branch_manager','operations_manager','sales_representative','counter_sales')
        and (member.branch_id is null or route.branch_id is null or member.branch_id = route.branch_id)
    ) then
      raise exception 'Temporary location requires an active route assigned to this team member.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_driving_session_scope on public.driving_sessions;
create trigger enforce_driving_session_scope
before insert or update on public.driving_sessions
for each row execute function public.enforce_driving_session_scope();

drop policy if exists "drivers start own driving session" on public.driving_sessions;
drop policy if exists "members start scoped operational session" on public.driving_sessions;
create policy "members start scoped operational session"
on public.driving_sessions
for insert
to authenticated
with check (
  driver_id = auth.uid()
  and (
    (
      session_kind = 'driving_day'
      and route_id is null
      and exists (
        select 1 from public.company_users member
        where member.company_id = driving_sessions.company_id
          and member.user_id = auth.uid()
          and member.role = 'driver'
          and (member.branch_id is null or driving_sessions.branch_id is null or member.branch_id = driving_sessions.branch_id)
      )
    )
    or
    (
      session_kind = 'temporary_route'
      and route_id is not null
      and exists (
        select 1
        from public.routes route
        join public.company_users member
          on member.company_id = route.company_id
         and member.user_id = route.driver_id
        where route.id = driving_sessions.route_id
          and route.company_id = driving_sessions.company_id
          and route.driver_id = auth.uid()
          and route.status in ('active','paused')
          and route.branch_id is not distinct from driving_sessions.branch_id
          and member.role in ('branch_manager','operations_manager','sales_representative','counter_sales')
          and (member.branch_id is null or route.branch_id is null or member.branch_id = route.branch_id)
      )
    )
  )
);

-- Completing, cancelling, or reporting an issue on a one-off route ends only
-- that temporary session. Normal Driver driving days remain active between
-- missions until the Driver explicitly ends the day.
create or replace function public.end_temporary_route_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('completed','issue','cancelled')
     and old.status is distinct from new.status then
    update public.driving_sessions
    set status = 'ended', ended_at = coalesce(ended_at, now()), last_updated_at = now()
    where route_id = new.id
      and session_kind = 'temporary_route'
      and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists end_temporary_route_session on public.routes;
create trigger end_temporary_route_session
after update of status on public.routes
for each row execute function public.end_temporary_route_session();

revoke all on function public.validate_branch_primary_driver() from public;
revoke all on function public.clear_invalid_branch_primary_driver() from public;
revoke all on function public.enforce_assigned_driver_route_update() from public;
revoke all on function public.enforce_driving_session_scope() from public;
revoke all on function public.end_temporary_route_session() from public;
