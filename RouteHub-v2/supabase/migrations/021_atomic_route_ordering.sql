-- RouteHub: atomic, per-driver route ordering.
-- Execute after migrations 001, 008 and 009.  This migration does not change
-- historical routes.  It only writes draft, pending, published or paused work.

create or replace function public.reorder_driver_routes(
  p_driver_id uuid,
  p_route_ids uuid[]
)
returns table(id uuid, position integer, origin_address text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_branch_id uuid;
  v_expected integer;
  v_actual integer;
  v_base_position integer;
  v_active_destination text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select cu.company_id, cu.branch_id into v_company_id, v_branch_id
  from public.company_users cu
  where cu.user_id = auth.uid()
    and cu.role in ('branch_manager', 'operations_manager', 'sales_representative')
  order by case cu.role when 'branch_manager' then 0 when 'operations_manager' then 1 else 2 end
  limit 1;

  if v_company_id is null then
    raise exception 'Only dispatch managers can reorder routes' using errcode = '42501';
  end if;

  -- Serialize competing changes to this driver's queue without locking other
  -- drivers in the same company.
  perform pg_advisory_xact_lock(hashtextextended(p_driver_id::text, 0));

  select count(*) into v_expected
  from public.routes r
  where r.company_id = v_company_id
    and r.driver_id = p_driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');

  select count(*) into v_actual
  from unnest(p_route_ids) as requested(id)
  join public.routes r on r.id = requested.id
  where r.company_id = v_company_id
    and r.driver_id = p_driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');

  if coalesce(array_length(p_route_ids, 1), 0) <> v_expected or v_actual <> v_expected then
    raise exception 'The route queue changed. Refresh and try again.' using errcode = '40001';
  end if;

  -- Completed, cancelled and active routes remain historical/current facts.
  -- New upcoming positions start after the last locked route for this driver.
  select coalesce(max(r.position), 0) into v_base_position
  from public.routes r
  where r.company_id = v_company_id
    and r.driver_id = p_driver_id
    and r.status in ('active', 'completed', 'cancelled', 'issue');

  -- Do not alter the active row. Its destination becomes the correct origin
  -- for the first route the manager places in the upcoming queue.
  select nullif(r.destination_address, '') into v_active_destination
  from public.routes r
  where r.company_id = v_company_id
    and r.driver_id = p_driver_id
    and r.status = 'active'
  order by r.position desc
  limit 1;

  -- Clear possible uniqueness collisions before writing the normalized queue.
  update public.routes r
  set position = position + 1000000
  where r.company_id = v_company_id
    and r.driver_id = p_driver_id
    and r.status in ('draft', 'pending', 'published', 'paused');

  with requested as (
    select id, ordinality::integer as queue_index
    from unnest(p_route_ids) with ordinality
  ), ordered as (
    select r.id,
      v_base_position + requested.queue_index as next_position,
      lag(r.destination_address) over (order by requested.queue_index) as previous_destination,
      requested.queue_index
    from requested
    join public.routes r on r.id = requested.id
  )
  update public.routes r
  set position = ordered.next_position,
      origin_address = case
        when ordered.queue_index = 1 and v_active_destination is not null then v_active_destination
        when ordered.queue_index = 1 then r.origin_address
        when nullif(ordered.previous_destination, '') is not null then ordered.previous_destination
        else r.origin_address
      end,
      updated_version = extract(epoch from clock_timestamp())::bigint
  from ordered
  where r.id = ordered.id;

  insert into public.activity_logs(company_id, user_id, action, after_value)
  values (v_company_id, auth.uid(), 'route_queue_reordered', jsonb_build_object('driver_id', p_driver_id, 'route_ids', p_route_ids));

  return query
  select r.id, r.position, r.origin_address
  from public.routes r
  where r.company_id = v_company_id
    and r.driver_id = p_driver_id
    and r.status in ('draft', 'pending', 'published', 'paused')
  order by r.position, r.id;
end;
$$;

grant execute on function public.reorder_driver_routes(uuid, uuid[]) to authenticated;

create or replace function public.reassign_upcoming_route(
  p_route_id uuid,
  p_driver_id uuid
)
returns table(id uuid, driver_id uuid, position integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_old_driver_id uuid;
  v_status text;
  v_next_position integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select cu.company_id into v_company_id from public.company_users cu
  where cu.user_id = auth.uid() and cu.role in ('branch_manager', 'operations_manager', 'sales_representative')
  limit 1;
  if v_company_id is null then raise exception 'Only dispatch managers can reassign routes' using errcode = '42501'; end if;

  select r.driver_id, r.status into v_old_driver_id, v_status
  from public.routes r where r.id = p_route_id and r.company_id = v_company_id for update;
  if v_old_driver_id is null then raise exception 'Route not found' using errcode = 'P0002'; end if;
  if v_status not in ('draft', 'pending', 'published', 'paused') then raise exception 'Only upcoming routes can be reassigned' using errcode = '23514'; end if;
  if v_old_driver_id = p_driver_id then return query select p_route_id, p_driver_id, (select position from public.routes where id=p_route_id); return; end if;
  if not exists (select 1 from public.company_users cu where cu.company_id=v_company_id and cu.user_id=p_driver_id) then raise exception 'Assignee is not in this company' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_old_driver_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_driver_id::text, 0));
  select coalesce(max(position),0)+1 into v_next_position from public.routes where company_id=v_company_id and driver_id=p_driver_id;
  update public.routes set driver_id=p_driver_id, position=v_next_position, updated_version=extract(epoch from clock_timestamp())::bigint where id=p_route_id;
  insert into public.activity_logs(company_id,user_id,action,record_id,after_value) values(v_company_id,auth.uid(),'route_reassigned',p_route_id,jsonb_build_object('from',v_old_driver_id,'to',p_driver_id));

  -- Normalize both queues by invoking the single ordering implementation.
  perform public.reorder_driver_routes(v_old_driver_id, coalesce((select array_agg(id order by position,id) from public.routes where company_id=v_company_id and driver_id=v_old_driver_id and status in ('draft','pending','published','paused')), array[]::uuid[]));
  perform public.reorder_driver_routes(p_driver_id, coalesce((select array_agg(id order by position,id) from public.routes where company_id=v_company_id and driver_id=p_driver_id and status in ('draft','pending','published','paused')), array[]::uuid[]));
  return query select r.id,r.driver_id,r.position from public.routes r where r.id=p_route_id;
end;
$$;

grant execute on function public.reassign_upcoming_route(uuid, uuid) to authenticated;
