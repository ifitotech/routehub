-- RouteHub: route positions are local to one queue:
-- company + branch + route date + assigned person.
-- This is additive and supersedes the legacy per-driver ordering RPC.

-- Keeps queue validation, locking and ordered reads efficient without changing
-- any existing route or RLS policy.
create index if not exists routes_queue_order_idx
  on public.routes (company_id, branch_id, route_date, driver_id, position);

create or replace function public.reorder_route_queue(p_route_ids uuid[])
returns table(id uuid, "position" integer, origin_address text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_anchor public.routes%rowtype;
  v_expected_ids uuid[];
  v_position_slots integer[];
  v_requested_count integer;
  v_expected_count integer;
  v_membership_exists boolean;
  v_queue_lock bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_route_ids), 0) = 0 then
    raise exception 'A route queue cannot be empty' using errcode = '22023';
  end if;

  select count(*) into v_requested_count from unnest(p_route_ids) as requested(id);
  if v_requested_count <> (select count(distinct requested.id) from unnest(p_route_ids) as requested(id)) then
    raise exception 'Route order contains duplicate route IDs' using errcode = '22023';
  end if;

  -- The first route establishes the queue; the browser never supplies a
  -- company, branch, date, or driver as proof of authority.
  select r.* into v_anchor
  from public.routes r
  where r.id = p_route_ids[1]
  for update;

  if not found then
    raise exception 'Route queue was not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = v_anchor.company_id
      and cu.role in ('branch_manager', 'operations_manager', 'sales_representative')
      -- A null membership branch represents company-wide dispatch access.
      and (cu.branch_id is null or cu.branch_id is not distinct from v_anchor.branch_id)
  ) into v_membership_exists;

  if not v_membership_exists then
    raise exception 'You are not allowed to reorder this route queue' using errcode = '42501';
  end if;

  -- Serialize concurrent queue edits while allowing independent drivers,
  -- branches and dates to be reordered at the same time.
  v_queue_lock := hashtextextended(
    concat_ws('|', v_anchor.company_id::text, coalesce(v_anchor.branch_id::text, '__no_branch__'), v_anchor.route_date::text, v_anchor.driver_id::text),
    0
  );
  perform pg_advisory_xact_lock(v_queue_lock);

  -- Lock the entire queue before validating it. This prevents two managers
  -- from interleaving reorders and guarantees all updates commit or roll back
  -- as one PostgreSQL transaction.
  perform 1
  from public.routes r
  where r.company_id = v_anchor.company_id
    and r.branch_id is not distinct from v_anchor.branch_id
    and r.route_date is not distinct from v_anchor.route_date
    and r.driver_id = v_anchor.driver_id
  for update;

  select
    coalesce(array_agg(r.id order by r.position, r.id), array[]::uuid[]),
    coalesce(array_agg(r.position order by r.position, r.id), array[]::integer[])
  into v_expected_ids, v_position_slots
  from public.routes r
  where r.company_id = v_anchor.company_id
    and r.branch_id is not distinct from v_anchor.branch_id
    and r.route_date is not distinct from v_anchor.route_date
    and r.driver_id = v_anchor.driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');

  v_expected_count := cardinality(v_expected_ids);
  if v_requested_count <> v_expected_count
     or exists (
       (select requested.id from unnest(p_route_ids) as requested(id))
       except
       (select expected.id from unnest(v_expected_ids) as expected(id))
     ) then
    raise exception 'The route queue changed or contains routes from another queue. Refresh and try again.' using errcode = '40001';
  end if;

  -- Move the mutable positions out of the way first. This is safe even when
  -- installations add a future unique queue-position constraint.
  update public.routes r
  set position = r.position + 1000000
  where r.company_id = v_anchor.company_id
    and r.branch_id is not distinct from v_anchor.branch_id
    and r.route_date is not distinct from v_anchor.route_date
    and r.driver_id = v_anchor.driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');

  -- Reuse RouteHub's planner semantics: locked rows retain their position and
  -- history; mutable rows reuse the queue's original position slots. The
  -- first movable route keeps its configured origin; every later route starts
  -- at the previous route's destination.
  with requested as (
    select requested.id, requested.ordinality::integer as queue_index
    from unnest(p_route_ids) with ordinality as requested(id, ordinality)
  ), slots as (
    select slot.position, slot.ordinality::integer as queue_index
    from unnest(v_position_slots) with ordinality as slot(position, ordinality)
  ), ordered as (
    select r.id,
      slots.position as next_position,
      requested.queue_index,
      lag(r.destination_address) over (order by requested.queue_index) as previous_address,
      lag(r.destination_name) over (order by requested.queue_index) as previous_name
    from requested
    join slots using (queue_index)
    join public.routes r on r.id = requested.id
  )
  update public.routes r
  set position = ordered.next_position,
      origin_address = case
        when ordered.queue_index = 1 then r.origin_address
        when nullif(ordered.previous_address, '') is not null then ordered.previous_address
        else r.origin_address
      end,
      origin_name = case
        when ordered.queue_index = 1 then r.origin_name
        when nullif(ordered.previous_name, '') is not null then ordered.previous_name
        else r.origin_name
      end,
      updated_version = coalesce(r.updated_version, 0) + 1
  from ordered
  where r.id = ordered.id;

  insert into public.activity_logs(company_id, user_id, action, after_value)
  values (
    v_anchor.company_id,
    auth.uid(),
    'route_queue_reordered',
    jsonb_build_object(
      'branch_id', v_anchor.branch_id,
      'route_date', v_anchor.route_date,
      'driver_id', v_anchor.driver_id,
      'route_ids', p_route_ids
    )
  );

  return query
  select r.id, r.position, r.origin_address
  from public.routes r
  where r.company_id = v_anchor.company_id
    and r.branch_id is not distinct from v_anchor.branch_id
    and r.route_date is not distinct from v_anchor.route_date
    and r.driver_id = v_anchor.driver_id
    and r.status in ('draft', 'pending', 'published', 'paused')
  order by r.position, r.id;
end;
$$;

revoke all on function public.reorder_route_queue(uuid[]) from public;
grant execute on function public.reorder_route_queue(uuid[]) to authenticated;

-- Reassignment remains a separate workflow. It normalizes only the source
-- and target queues, never every route belonging to either driver.
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

  select r.* into v_route from public.routes r where r.id = p_route_id for update;
  if not found then raise exception 'Route not found' using errcode = 'P0002'; end if;
  if v_route.status not in ('draft', 'pending', 'published', 'paused') then
    raise exception 'Only upcoming routes can be reassigned' using errcode = '23514';
  end if;

  select exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid() and cu.company_id = v_route.company_id
      and cu.role in ('branch_manager', 'operations_manager', 'sales_representative')
      and (cu.branch_id is null or cu.branch_id is not distinct from v_route.branch_id)
  ) into v_allowed;
  if not v_allowed then raise exception 'You are not allowed to reassign this route' using errcode = '42501'; end if;

  select exists (
    select 1 from public.company_users cu
    where cu.company_id = v_route.company_id and cu.user_id = p_driver_id
      and (cu.branch_id is null or cu.branch_id is not distinct from v_route.branch_id)
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

  select coalesce(max(r.position), 0) + 1 into v_target_next_position
  from public.routes r
  where r.company_id = v_route.company_id
    and r.branch_id is not distinct from v_route.branch_id
    and r.route_date is not distinct from v_route.route_date
    and r.driver_id = p_driver_id;

  update public.routes
  set driver_id = p_driver_id,
      position = v_target_next_position,
      updated_version = coalesce(updated_version, 0) + 1
  where id = p_route_id;

  select coalesce(array_agg(r.id order by r.position, r.id), array[]::uuid[]) into v_source_ids
  from public.routes r
  where r.company_id = v_route.company_id and r.branch_id is not distinct from v_route.branch_id
    and r.route_date is not distinct from v_route.route_date and r.driver_id = v_route.driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');
  if cardinality(v_source_ids) > 0 then perform public.reorder_route_queue(v_source_ids); end if;

  select coalesce(array_agg(r.id order by r.position, r.id), array[]::uuid[]) into v_target_ids
  from public.routes r
  where r.company_id = v_route.company_id and r.branch_id is not distinct from v_route.branch_id
    and r.route_date is not distinct from v_route.route_date and r.driver_id = p_driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');
  if cardinality(v_target_ids) > 0 then perform public.reorder_route_queue(v_target_ids); end if;

  insert into public.activity_logs(company_id, user_id, action, record_id, after_value)
  values (v_route.company_id, auth.uid(), 'route_reassigned', p_route_id, jsonb_build_object('from', v_route.driver_id, 'to', p_driver_id));

  return query select r.id, r.driver_id, r.position from public.routes r where r.id = p_route_id;
end;
$$;

revoke all on function public.reassign_upcoming_route(uuid, uuid) from public;
grant execute on function public.reassign_upcoming_route(uuid, uuid) to authenticated;
