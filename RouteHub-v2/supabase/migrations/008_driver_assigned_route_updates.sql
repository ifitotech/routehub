-- Allow an assigned driver to operate only their own route while preserving
-- company isolation and preventing edits to dispatch-controlled fields.
-- Safe to run more than once after migrations 001 and 002.

alter table public.routes enable row level security;

-- Some installations received this constraint from dynamic_route_planner.sql.
-- NOT VALID avoids blocking this additive migration because of legacy rows.
alter table public.routes drop constraint if exists routes_status_check;
alter table public.routes add constraint routes_status_check
  check (status in ('draft','pending','published','active','paused','completed','issue','cancelled'))
  not valid;

drop policy if exists "drivers update assigned routes" on public.routes;
create policy "drivers update assigned routes"
on public.routes
for update
to authenticated
using (
  driver_id = auth.uid()
  and exists (
    select 1
    from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = routes.company_id
      and cu.role = 'driver'
  )
)
with check (
  driver_id = auth.uid()
  and exists (
    select 1
    from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = routes.company_id
      and cu.role = 'driver'
  )
);

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
  if actor is null or old.driver_id is distinct from actor then
    return new;
  end if;

  select exists (
    select 1
    from public.company_users cu
    where cu.user_id = actor
      and cu.company_id = old.company_id
      and cu.role in ('branch_manager','operations_manager','sales_representative')
  ) into actor_is_dispatch;

  -- A dispatcher who is also assigned as driver keeps normal dispatch access.
  if actor_is_dispatch then
    return new;
  end if;

  if (to_jsonb(new) - allowed_columns) is distinct from (to_jsonb(old) - allowed_columns) then
    raise exception 'Drivers may only update route progress, evidence, GPS, and issue notes.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not (
    (old.status in ('draft','pending','published') and new.status = 'active')
    or (old.status = 'active' and new.status in ('paused','completed','issue'))
    or (old.status = 'paused' and new.status in ('active','completed','issue'))
  ) then
    raise exception 'Invalid driver route status transition: % to %.', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_assigned_driver_route_update on public.routes;
create trigger enforce_assigned_driver_route_update
before update on public.routes
for each row
execute function public.enforce_assigned_driver_route_update();

