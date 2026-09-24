-- reassign_upcoming_route left route_started_at/arrived_at untouched when
-- moving a route to a different driver or back to Unassigned. Those two
-- timestamps (not the status column) are what Driver's own
-- driverOperationPhase() checks to decide a stop is already "started" -
-- a route a previous driver had begun (then paused, per the Manager
-- drag/unassign flow) kept showing the new driver live in-app navigation
-- ("Ruta activa") the instant they opened Today, before they ever pressed
-- Start. reschedule_issue_route (20260923143000) already resets these same
-- fields for issue routes; this applies the same fix to the normal
-- upcoming-route reassignment path (drag-and-drop and the "Move to
-- driver" dropdown both call this function).
create or replace function public.reassign_upcoming_route(p_route_id uuid, p_driver_id uuid)
returns table(id uuid, driver_id uuid, "position" integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_route public.routes%rowtype;
  v_source_ids uuid[];
  v_target_ids uuid[];
  v_target_next_position integer;
  v_allowed boolean;
  v_target_allowed boolean;
  v_source_lock bigint;
  v_target_lock bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select route_row.* into v_route from public.routes route_row where route_row.id = p_route_id for update;
  if not found then raise exception 'Route not found' using errcode = 'P0002'; end if;
  if v_route.status not in ('draft', 'pending', 'published', 'paused') then
    raise exception 'Only upcoming routes can be reassigned' using errcode = '23514';
  end if;

  select exists (
    select 1 from public.company_users membership
    where membership.user_id = auth.uid() and membership.company_id = v_route.company_id
      and membership.role in ('branch_manager', 'operations_manager', 'sales_representative')
      and (membership.branch_id is null or membership.branch_id is not distinct from v_route.branch_id)
  ) into v_allowed;
  if not v_allowed then raise exception 'You are not allowed to reassign this route' using errcode = '42501'; end if;

  select exists (
    select 1 from public.company_users membership
    where membership.company_id = v_route.company_id and membership.user_id = p_driver_id
      and (membership.branch_id is null or membership.branch_id is not distinct from v_route.branch_id)
  ) into v_target_allowed;
  if not v_target_allowed then raise exception 'Assignee is not available in this branch' using errcode = '42501'; end if;

  if v_route.driver_id = p_driver_id then
    return query select v_route.id, v_route.driver_id, v_route.position;
    return;
  end if;

  v_source_lock := hashtextextended(concat_ws('|', v_route.company_id::text, coalesce(v_route.branch_id::text, '__no_branch__'), v_route.route_date::text, v_route.driver_id::text), 0);
  v_target_lock := hashtextextended(concat_ws('|', v_route.company_id::text, coalesce(v_route.branch_id::text, '__no_branch__'), v_route.route_date::text, p_driver_id::text), 0);
  if v_source_lock < v_target_lock then
    perform pg_advisory_xact_lock(v_source_lock); perform pg_advisory_xact_lock(v_target_lock);
  else
    perform pg_advisory_xact_lock(v_target_lock); perform pg_advisory_xact_lock(v_source_lock);
  end if;

  select coalesce(max(route_row.position), 0) + 1 into v_target_next_position
  from public.routes route_row
  where route_row.company_id = v_route.company_id
    and route_row.branch_id is not distinct from v_route.branch_id
    and route_row.route_date is not distinct from v_route.route_date
    and route_row.driver_id = p_driver_id;

  update public.routes as target_route
  set driver_id = p_driver_id,
      position = v_target_next_position,
      -- A route moving to a new driver (or back to Unassigned first) is
      -- 'paused' only because it was mid-drive for its PREVIOUS driver -
      -- the new one should see a clean upcoming stop, not a paused one
      -- they never started.
      status = case when target_route.status = 'paused' then 'published' else target_route.status end,
      route_started_at = null,
      arrived_at = null,
      updated_version = coalesce(target_route.updated_version, 0) + 1
  where target_route.id = p_route_id;

  select coalesce(array_agg(route_row.id order by route_row.position, route_row.id), array[]::uuid[]) into v_source_ids
  from public.routes route_row
  where route_row.company_id = v_route.company_id and route_row.branch_id is not distinct from v_route.branch_id
    and route_row.route_date is not distinct from v_route.route_date and route_row.driver_id = v_route.driver_id
    and route_row.status in ('draft', 'pending', 'published', 'paused');
  if cardinality(v_source_ids) > 0 then perform public.reorder_route_queue(v_source_ids); end if;

  select coalesce(array_agg(route_row.id order by route_row.position, route_row.id), array[]::uuid[]) into v_target_ids
  from public.routes route_row
  where route_row.company_id = v_route.company_id and route_row.branch_id is not distinct from v_route.branch_id
    and route_row.route_date is not distinct from v_route.route_date and route_row.driver_id = p_driver_id
    and route_row.status in ('draft', 'pending', 'published', 'paused');
  if cardinality(v_target_ids) > 0 then perform public.reorder_route_queue(v_target_ids); end if;

  insert into public.activity_logs(company_id, user_id, action, record_id, after_value)
  values (v_route.company_id, auth.uid(), 'route_reassigned', p_route_id, jsonb_build_object('from', v_route.driver_id, 'to', p_driver_id));

  return query select route_row.id, route_row.driver_id, route_row.position from public.routes route_row where route_row.id = p_route_id;
end;
$$;

revoke all on function public.reassign_upcoming_route(uuid, uuid) from public;
grant execute on function public.reassign_upcoming_route(uuid, uuid) to authenticated;
