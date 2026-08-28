-- RouteHub: persist the duration of an operational route separately from
-- the driver's Driving Day session. Timestamps live on route rows so this is
-- additive to the existing queue model and survives refresh/reconnects.
alter table public.routes
  add column if not exists route_started_at timestamptz,
  add column if not exists route_completed_at timestamptz;

create index if not exists routes_route_duration_queue_idx
  on public.routes(company_id, branch_id, driver_id, route_date, route_started_at);

-- Keep the existing driver update boundary while allowing the two route timer
-- fields to be written by the assigned driver. Start/completion writes remain
-- guarded by the application queue flow and are never client-only state.
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
    'driver_note','customer_signature_path','finalized_at','finalization_method',
    'finalization_note','finalization_issue','finalization_photo_path',
    'arrived_at','route_started_at','route_completed_at'
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

  if actor_is_dispatch then
    return new;
  end if;

  if (to_jsonb(new) - allowed_columns) is distinct from (to_jsonb(old) - allowed_columns) then
    raise exception 'Drivers may only update route progress, evidence, location, and issue notes.'
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

revoke all on function public.enforce_assigned_driver_route_update() from public;
notify pgrst, 'reload schema';
