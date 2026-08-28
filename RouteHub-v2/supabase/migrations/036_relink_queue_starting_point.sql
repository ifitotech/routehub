-- RouteHub: reordering must rebuild the full route chain, including the
-- starting point and coordinate pair used by the driver map.

alter table public.routes
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision;

alter table public.branches
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

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
  v_branch_address text;
  v_branch_name text;
  v_branch_lat double precision;
  v_branch_lng double precision;
  v_prefix_address text;
  v_prefix_name text;
  v_prefix_lat double precision;
  v_prefix_lng double precision;
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

  select r.* into v_anchor from public.routes r where r.id = p_route_ids[1] for update;
  if not found then
    raise exception 'Route queue was not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.company_users cu
    where cu.user_id = auth.uid()
      and cu.company_id = v_anchor.company_id
      and cu.role in ('branch_manager', 'operations_manager', 'sales_representative')
      and (cu.branch_id is null or cu.branch_id is not distinct from v_anchor.branch_id)
  ) into v_membership_exists;
  if not v_membership_exists then
    raise exception 'You are not allowed to reorder this route queue' using errcode = '42501';
  end if;

  v_queue_lock := hashtextextended(concat_ws('|', v_anchor.company_id::text, coalesce(v_anchor.branch_id::text, '__no_branch__'), v_anchor.route_date::text, v_anchor.driver_id::text), 0);
  perform pg_advisory_xact_lock(v_queue_lock);

  perform 1 from public.routes r
  where r.company_id = v_anchor.company_id
    and r.branch_id is not distinct from v_anchor.branch_id
    and r.route_date is not distinct from v_anchor.route_date
    and r.driver_id = v_anchor.driver_id
  for update;

  select coalesce(array_agg(r.id order by r.position, r.id), array[]::uuid[]),
         coalesce(array_agg(r.position order by r.position, r.id), array[]::integer[])
  into v_expected_ids, v_position_slots
  from public.routes r
  where r.company_id = v_anchor.company_id
    and r.branch_id is not distinct from v_anchor.branch_id
    and r.route_date is not distinct from v_anchor.route_date
    and r.driver_id = v_anchor.driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');

  v_expected_count := cardinality(v_expected_ids);
  if v_requested_count <> v_expected_count or exists (
    (select requested.id from unnest(p_route_ids) as requested(id))
    except (select expected.id from unnest(v_expected_ids) as expected(id))
  ) then
    raise exception 'The route queue changed or contains routes from another queue. Refresh and try again.' using errcode = '40001';
  end if;

  -- A locked stop before the mutable portion is the true current starting
  -- point. Otherwise the branch is the queue start. This prevents a moved
  -- stop from keeping the destination of its old predecessor as its origin.
  select r.destination_address, r.destination_name, r.destination_lat, r.destination_lng
  into v_prefix_address, v_prefix_name, v_prefix_lat, v_prefix_lng
  from public.routes r
  where r.company_id = v_anchor.company_id
    and r.branch_id is not distinct from v_anchor.branch_id
    and r.route_date is not distinct from v_anchor.route_date
    and r.driver_id = v_anchor.driver_id
    and r.position < (select min(slot) from unnest(v_position_slots) as slot)
    and r.status in ('active', 'completed', 'issue')
  order by r.position desc, r.id desc
  limit 1;

  if v_prefix_address is null and v_anchor.branch_id is not null then
    select coalesce(nullif(b.address, ''), b.name), b.name, b.latitude, b.longitude
    into v_branch_address, v_branch_name, v_branch_lat, v_branch_lng
    from public.branches b
    where b.id = v_anchor.branch_id;
  end if;

  update public.routes r set position = r.position + 1000000
  where r.company_id = v_anchor.company_id
    and r.branch_id is not distinct from v_anchor.branch_id
    and r.route_date is not distinct from v_anchor.route_date
    and r.driver_id = v_anchor.driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');

  with requested as (
    select requested.id, requested.ordinality::integer as queue_index
    from unnest(p_route_ids) with ordinality as requested(id, ordinality)
  ), slots as (
    select slot.position, slot.ordinality::integer as queue_index
    from unnest(v_position_slots) with ordinality as slot(position, ordinality)
  ), ordered as (
    select r.id, slots.position as next_position, requested.queue_index,
      lag(r.destination_address) over (order by requested.queue_index) as previous_address,
      lag(r.destination_name) over (order by requested.queue_index) as previous_name,
      lag(r.destination_lat) over (order by requested.queue_index) as previous_lat,
      lag(r.destination_lng) over (order by requested.queue_index) as previous_lng
    from requested
    join slots using (queue_index)
    join public.routes r on r.id = requested.id
  )
  update public.routes r
  set position = ordered.next_position,
      origin_address = case
        when ordered.queue_index = 1 then coalesce(nullif(v_prefix_address, ''), nullif(v_branch_address, ''), r.origin_address)
        when nullif(ordered.previous_address, '') is not null then ordered.previous_address
        else r.origin_address
      end,
      origin_name = case
        when ordered.queue_index = 1 then coalesce(nullif(v_prefix_name, ''), nullif(v_branch_name, ''), r.origin_name)
        when nullif(ordered.previous_name, '') is not null then ordered.previous_name
        else r.origin_name
      end,
      origin_lat = case
        when ordered.queue_index = 1 and v_prefix_address is not null then v_prefix_lat
        when ordered.queue_index = 1 and v_branch_address is not null then v_branch_lat
        when ordered.previous_lat is not null and ordered.previous_lng is not null then ordered.previous_lat
        else r.origin_lat
      end,
      origin_lng = case
        when ordered.queue_index = 1 and v_prefix_address is not null then v_prefix_lng
        when ordered.queue_index = 1 and v_branch_address is not null then v_branch_lng
        when ordered.previous_lat is not null and ordered.previous_lng is not null then ordered.previous_lng
        else r.origin_lng
      end,
      updated_version = coalesce(r.updated_version, 0) + 1
  from ordered
  where r.id = ordered.id;

  insert into public.activity_logs(company_id, user_id, action, after_value)
  values (v_anchor.company_id, auth.uid(), 'route_queue_reordered', jsonb_build_object('branch_id', v_anchor.branch_id, 'route_date', v_anchor.route_date, 'driver_id', v_anchor.driver_id, 'route_ids', p_route_ids));

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

notify pgrst, 'reload schema';
