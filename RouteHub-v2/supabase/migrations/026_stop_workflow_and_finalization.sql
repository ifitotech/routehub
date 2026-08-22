-- Stop workflow: additive fields only. Existing pickup, delivery, transfer and
-- return rows stay valid. `return` remains the persisted legacy value and is
-- presented by the app as a Branch stop.
alter table public.routes
  add column if not exists arrived_at timestamptz,
  add column if not exists driver_note text,
  add column if not exists destination_phone text,
  add column if not exists customer_signature_path text,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalization_method text,
  add column if not exists finalization_note text,
  add column if not exists finalization_issue text,
  add column if not exists finalization_photo_path text;

create index if not exists routes_queue_finalized_idx
  on public.routes(company_id, branch_id, route_date, driver_id, finalized_at)
  where finalized_at is not null;

-- A finalization lives on the final stop of the existing ordered queue. This
-- preserves RouteHub's current stop-per-row data model and needs no rewrite of
-- live or historical rows.
create or replace function public.enforce_route_queue_finalization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.finalized_at is not null and old.finalized_at is null then
    if old.status <> 'completed' then
      raise exception 'Complete the final stop before completing the route.' using errcode = '23514';
    end if;
    if new.finalization_method not in ('normal','photo','issue') then
      raise exception 'Choose a valid route completion method.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.routes route
      where route.company_id = old.company_id
        and route.branch_id is not distinct from old.branch_id
        and route.route_date is not distinct from old.route_date
        and route.driver_id = old.driver_id
        and route.status not in ('completed','cancelled')
    ) then
      raise exception 'Every required stop must be completed before closing the route.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.routes route
      where route.company_id = old.company_id
        and route.branch_id is not distinct from old.branch_id
        and route.route_date is not distinct from old.route_date
        and route.driver_id = old.driver_id
        and route.id <> old.id
        and route.finalized_at is not null
    ) then
      raise exception 'This route queue is already completed.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.routes route
      where route.company_id = old.company_id
        and route.branch_id is not distinct from old.branch_id
        and route.route_date is not distinct from old.route_date
        and route.driver_id = old.driver_id
        and route.status <> 'cancelled'
        and (route.position > old.position or (route.position = old.position and route.id > old.id))
    ) then
      raise exception 'Store route completion on the final stop in the queue.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_route_queue_finalization on public.routes;
create trigger enforce_route_queue_finalization
before update of finalized_at, finalization_method, finalization_note, finalization_issue, finalization_photo_path
on public.routes
for each row execute function public.enforce_route_queue_finalization();

-- Preserve the existing assignment boundary while allowing the driver to mark
-- arrival, add an execution note, and safely close an already-completed queue.
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
    'completion_warning','completion_photo_path','notes','driver_confirmed_at',
    'arrived_at','driver_note','customer_signature_path','finalized_at','finalization_method',
    'finalization_note','finalization_issue','finalization_photo_path'
  ];
begin
  if actor is null or old.driver_id is distinct from actor then return new; end if;
  select exists (
    select 1 from public.company_users member
    where member.user_id = actor and member.company_id = old.company_id
      and member.role in ('branch_manager','operations_manager','sales_representative')
  ) into actor_is_dispatch;
  if actor_is_dispatch then return new; end if;
  if (to_jsonb(new) - allowed_columns) is distinct from (to_jsonb(old) - allowed_columns) then
    raise exception 'Assigned members may only update route progress, evidence, location, and issue notes.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (
    (old.status in ('draft','pending','published') and new.status = 'active')
    or (old.status = 'active' and new.status in ('paused','completed','issue'))
    or (old.status = 'paused' and new.status in ('active','completed','issue'))
    or (old.status = 'issue' and new.status = 'completed')
  ) then
    raise exception 'Invalid assigned route status transition: % to %.', old.status, new.status using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_route_queue_finalization() from public;
revoke all on function public.enforce_assigned_driver_route_update() from public;
