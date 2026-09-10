-- Manager-only operational controls. They preserve the existing Driver queue:
-- a priority interruption pauses current work, and moving an unstarted stop
-- changes only its assigned day/queue.

create or replace function public.prioritize_route_now(p_route_id uuid)
returns table(id uuid, status text, priority text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_route public.routes%rowtype;
  v_allowed boolean;
  v_lock bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_route from public.routes where id = p_route_id for update;
  if not found then raise exception 'Route not found' using errcode = 'P0002'; end if;
  if v_route.driver_id is null or v_route.status not in ('draft','pending','published','paused') then
    raise exception 'Only an uncompleted assigned route can be prioritized' using errcode = '23514';
  end if;
  select exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid() and cu.company_id = v_route.company_id
      and cu.role in ('branch_manager','operations_manager','sales_representative')
      and (cu.branch_id is null or cu.branch_id is not distinct from v_route.branch_id)
  ) into v_allowed;
  if not v_allowed then raise exception 'You are not allowed to prioritize this route' using errcode = '42501'; end if;

  v_lock := hashtextextended(concat_ws('|', v_route.company_id::text, v_route.driver_id::text), 0);
  perform pg_advisory_xact_lock(v_lock);
  update public.routes
  set status = 'paused', updated_version = coalesce(updated_version, 0) + 1
  where company_id = v_route.company_id and driver_id = v_route.driver_id
    and status = 'active' and id <> v_route.id;
  update public.routes
  set status = 'active', priority = 'urgent', route_started_at = coalesce(route_started_at, now()), updated_version = coalesce(updated_version, 0) + 1
  where id = v_route.id;
  insert into public.activity_logs(company_id, user_id, action, record_id, after_value)
  values (v_route.company_id, auth.uid(), 'route_prioritized_by_manager', v_route.id, jsonb_build_object('paused_active_route', true));
  return query select r.id, r.status, r.priority from public.routes r where r.id = v_route.id;
end;
$$;

revoke all on function public.prioritize_route_now(uuid) from public;
grant execute on function public.prioritize_route_now(uuid) to authenticated;

create or replace function public.reschedule_upcoming_route(p_route_id uuid, p_route_date date)
returns table(id uuid, route_date date, "position" integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_route public.routes%rowtype;
  v_allowed boolean;
  v_next_position integer;
  v_previous public.routes%rowtype;
  v_source_ids uuid[];
  v_target_ids uuid[];
  v_source_lock bigint;
  v_target_lock bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_route_date is null then raise exception 'A route date is required' using errcode = '22023'; end if;
  select * into v_route from public.routes where id = p_route_id for update;
  if not found then raise exception 'Route not found' using errcode = 'P0002'; end if;
  if v_route.driver_id is null or v_route.status not in ('draft','pending','published') then
    raise exception 'Only an unstarted route can be moved to another day' using errcode = '23514';
  end if;
  select exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid() and cu.company_id = v_route.company_id
      and cu.role in ('branch_manager','operations_manager','sales_representative')
      and (cu.branch_id is null or cu.branch_id is not distinct from v_route.branch_id)
  ) into v_allowed;
  if not v_allowed then raise exception 'You are not allowed to reschedule this route' using errcode = '42501'; end if;
  if v_route.route_date is not distinct from p_route_date then
    return query select v_route.id, v_route.route_date, v_route.position;
    return;
  end if;

  -- Lock both day queues in a stable order. A reschedule must never leave an
  -- old queue with stale positions or a new queue with disconnected origins.
  v_source_lock := hashtextextended(concat_ws('|', v_route.company_id::text, coalesce(v_route.branch_id::text, '__no_branch__'), v_route.route_date::text, v_route.driver_id::text), 0);
  v_target_lock := hashtextextended(concat_ws('|', v_route.company_id::text, coalesce(v_route.branch_id::text, '__no_branch__'), p_route_date::text, v_route.driver_id::text), 0);
  if v_source_lock < v_target_lock then
    perform pg_advisory_xact_lock(v_source_lock);
    perform pg_advisory_xact_lock(v_target_lock);
  else
    perform pg_advisory_xact_lock(v_target_lock);
    perform pg_advisory_xact_lock(v_source_lock);
  end if;
  select r.* into v_previous from public.routes r
  where r.company_id = v_route.company_id and r.branch_id is not distinct from v_route.branch_id
    and r.driver_id = v_route.driver_id and r.route_date = p_route_date
    and r.status in ('draft','pending','published','paused')
  order by r.position desc, r.id desc limit 1;
  select coalesce(max(r.position), 0) + 1 into v_next_position from public.routes r
  where r.company_id = v_route.company_id and r.branch_id is not distinct from v_route.branch_id
    and r.driver_id = v_route.driver_id and r.route_date = p_route_date;
  update public.routes
  set route_date = p_route_date,
      position = v_next_position,
      origin_address = coalesce(nullif(v_previous.destination_address, ''), origin_address),
      origin_name = coalesce(nullif(v_previous.destination_name, ''), origin_name),
      updated_version = coalesce(updated_version, 0) + 1
  where id = v_route.id;

  select coalesce(array_agg(r.id order by r.position, r.id), array[]::uuid[])
  into v_source_ids
  from public.routes r
  where r.company_id = v_route.company_id
    and r.branch_id is not distinct from v_route.branch_id
    and r.route_date is not distinct from v_route.route_date
    and r.driver_id = v_route.driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');
  if cardinality(v_source_ids) > 0 then
    perform public.reorder_route_queue(v_source_ids);
  end if;

  select coalesce(array_agg(r.id order by r.position, r.id), array[]::uuid[])
  into v_target_ids
  from public.routes r
  where r.company_id = v_route.company_id
    and r.branch_id is not distinct from v_route.branch_id
    and r.route_date is not distinct from p_route_date
    and r.driver_id = v_route.driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');
  if cardinality(v_target_ids) > 0 then
    perform public.reorder_route_queue(v_target_ids);
  end if;
  insert into public.activity_logs(company_id, user_id, action, record_id, after_value)
  values (v_route.company_id, auth.uid(), 'route_rescheduled_by_manager', v_route.id, jsonb_build_object('from_date', v_route.route_date, 'to_date', p_route_date));
  return query select r.id, r.route_date, r.position from public.routes r where r.id = v_route.id;
end;
$$;

revoke all on function public.reschedule_upcoming_route(uuid, date) from public;
grant execute on function public.reschedule_upcoming_route(uuid, date) to authenticated;
