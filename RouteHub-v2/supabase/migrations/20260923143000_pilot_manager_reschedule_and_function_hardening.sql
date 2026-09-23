-- Pilot hardening for Manager issue recovery and internal trigger functions.
-- This migration is additive and does not remove route history or evidence.

create or replace function public.reschedule_issue_route(
  p_route_id uuid,
  p_route_date date,
  p_scheduled_at timestamptz
)
returns table(id uuid, route_date date, scheduled_at timestamptz, "position" integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_route public.routes%rowtype;
  v_previous public.routes%rowtype;
  v_allowed boolean;
  v_next_position integer;
  v_source_ids uuid[];
  v_target_ids uuid[];
  v_source_lock bigint;
  v_target_lock bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_route_date is null or p_scheduled_at is null then
    raise exception 'A route date and time are required' using errcode = '22023';
  end if;

  select route_row.* into v_route
  from public.routes route_row
  where route_row.id = p_route_id
  for update;

  if not found then
    raise exception 'Route not found' using errcode = 'P0002';
  end if;
  if v_route.driver_id is null or v_route.status <> 'issue' then
    raise exception 'Only an open issue can be rescheduled' using errcode = '23514';
  end if;

  select exists (
    select 1
    from public.company_users membership
    where membership.user_id = auth.uid()
      and membership.company_id = v_route.company_id
      and membership.role in ('branch_manager', 'operations_manager', 'sales_representative')
      and (membership.branch_id is null or membership.branch_id is not distinct from v_route.branch_id)
  ) into v_allowed;
  if not v_allowed then
    raise exception 'You are not allowed to reschedule this issue' using errcode = '42501';
  end if;

  v_source_lock := hashtextextended(concat_ws('|', v_route.company_id::text, coalesce(v_route.branch_id::text, '__no_branch__'), coalesce(v_route.route_date::text, '__no_date__'), v_route.driver_id::text), 0);
  v_target_lock := hashtextextended(concat_ws('|', v_route.company_id::text, coalesce(v_route.branch_id::text, '__no_branch__'), p_route_date::text, v_route.driver_id::text), 0);
  if v_source_lock < v_target_lock then
    perform pg_advisory_xact_lock(v_source_lock);
    perform pg_advisory_xact_lock(v_target_lock);
  elsif v_source_lock > v_target_lock then
    perform pg_advisory_xact_lock(v_target_lock);
    perform pg_advisory_xact_lock(v_source_lock);
  else
    perform pg_advisory_xact_lock(v_source_lock);
  end if;

  select target.* into v_previous
  from public.routes target
  where target.company_id = v_route.company_id
    and target.branch_id is not distinct from v_route.branch_id
    and target.driver_id = v_route.driver_id
    and target.route_date = p_route_date
    and target.id <> v_route.id
    and target.status in ('draft', 'pending', 'published', 'paused')
  order by target.position desc, target.id desc
  limit 1;

  select coalesce(max(target.position), 0) + 1 into v_next_position
  from public.routes target
  where target.company_id = v_route.company_id
    and target.branch_id is not distinct from v_route.branch_id
    and target.driver_id = v_route.driver_id
    and target.route_date = p_route_date
    and target.id <> v_route.id;

  update public.routes target
  set status = 'published',
      route_date = p_route_date,
      scheduled_at = p_scheduled_at,
      position = v_next_position,
      origin_address = coalesce(nullif(v_previous.destination_address, ''), target.origin_address),
      origin_name = coalesce(nullif(v_previous.destination_name, ''), target.origin_name),
      arrived_at = null,
      completed_at = null,
      route_started_at = null,
      route_completed_at = null,
      completion_lat = null,
      completion_lng = null,
      completion_accuracy = null,
      completion_distance_m = null,
      completion_method = null,
      completion_warning = null,
      completion_photo_path = null,
      customer_signature_path = null,
      finalized_at = null,
      finalization_method = null,
      finalization_note = null,
      finalization_issue = null,
      finalization_photo_path = null,
      driver_note = null,
      updated_version = coalesce(target.updated_version, 0) + 1
  where target.id = v_route.id;

  select coalesce(array_agg(source.id order by source.position, source.id), array[]::uuid[])
  into v_source_ids
  from public.routes source
  where source.company_id = v_route.company_id
    and source.branch_id is not distinct from v_route.branch_id
    and source.route_date is not distinct from v_route.route_date
    and source.driver_id = v_route.driver_id
    and source.status in ('draft', 'pending', 'published', 'paused');
  if cardinality(v_source_ids) > 0 then
    perform public.reorder_route_queue(v_source_ids);
  end if;

  select coalesce(array_agg(target.id order by target.position, target.id), array[]::uuid[])
  into v_target_ids
  from public.routes target
  where target.company_id = v_route.company_id
    and target.branch_id is not distinct from v_route.branch_id
    and target.route_date = p_route_date
    and target.driver_id = v_route.driver_id
    and target.status in ('draft', 'pending', 'published', 'paused');
  if cardinality(v_target_ids) > 0 and v_target_ids is distinct from v_source_ids then
    perform public.reorder_route_queue(v_target_ids);
  end if;

  insert into public.activity_logs(company_id, user_id, action, record_id, before_value, after_value)
  values (
    v_route.company_id,
    auth.uid(),
    'issue_route_rescheduled',
    v_route.id,
    jsonb_build_object('status', v_route.status, 'route_date', v_route.route_date, 'scheduled_at', v_route.scheduled_at, 'driver_note', v_route.driver_note),
    jsonb_build_object('status', 'published', 'route_date', p_route_date, 'scheduled_at', p_scheduled_at)
  );

  return query
  select result.id, result.route_date, result.scheduled_at, result.position
  from public.routes result
  where result.id = v_route.id;
end;
$$;

revoke all on function public.reschedule_issue_route(uuid, date, timestamptz) from public;
revoke all on function public.reschedule_issue_route(uuid, date, timestamptz) from anon;
grant execute on function public.reschedule_issue_route(uuid, date, timestamptz) to authenticated, service_role;

-- These are invoked only by database triggers. Authenticated clients never
-- need permission to call them directly.
revoke execute on function public.clear_invalid_branch_primary_driver() from public, anon, authenticated;
revoke execute on function public.end_temporary_route_session() from public, anon, authenticated;
revoke execute on function public.enforce_assigned_driver_route_update() from public, anon, authenticated;
revoke execute on function public.enforce_driving_session_scope() from public, anon, authenticated;
revoke execute on function public.enforce_one_active_route_per_driver() from public, anon, authenticated;
revoke execute on function public.enforce_route_queue_finalization() from public, anon, authenticated;
revoke execute on function public.validate_branch_primary_driver() from public, anon, authenticated;

-- Retention is a scheduled service operation, not a browser RPC.
revoke execute on function public.purge_expired_routehub_evidence() from public, anon, authenticated;
grant execute on function public.purge_expired_routehub_evidence() to service_role;

-- Pin search paths for the two remaining mutable-path functions reported by
-- the Supabase security advisor.
alter function public.start_branch_premium_trial(uuid) set search_path = public, pg_temp;
alter function public.apply_routehub_plan_limits() set search_path = public, pg_temp;
