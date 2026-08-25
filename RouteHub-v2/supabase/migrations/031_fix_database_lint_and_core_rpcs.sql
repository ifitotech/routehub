-- Repairs three production RPC defects found by the remote schema linter.
-- This migration only replaces function bodies; it does not alter or remove data.

create or replace function public.purge_expired_routehub_evidence()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Keep this scheduled compatibility hook valid without deleting beta
  -- evidence. Retention can be introduced later through an explicit policy.
  return;
end;
$$;

create or replace function public.claim_team_invitation(target_invitation_id uuid)
returns table(company_id uuid, branch_id uuid, role text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invite_row public.invitations%rowtype;
  authenticated_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select lower(users.email)
  into authenticated_email
  from auth.users users
  where users.id = auth.uid();

  if authenticated_email is null or authenticated_email = '' then
    raise exception 'The authenticated account has no email address';
  end if;

  select invitation.*
  into invite_row
  from public.invitations invitation
  where invitation.id = target_invitation_id
    and lower(invitation.email) = authenticated_email
    and invitation.status = 'pending'
    and invitation.revoked_at is null
    and (invitation.expires_at is null or invitation.expires_at > now())
    and invitation.role in ('branch_manager','operations_manager','sales_representative','counter_sales','driver')
  for update;

  if invite_row.id is null then
    raise exception 'Invitation is not pending, does not belong to this account, or has expired';
  end if;

  insert into public.users(id, email, name)
  values (
    auth.uid(),
    authenticated_email,
    coalesce(
      (select auth_users.raw_user_meta_data ->> 'full_name' from auth.users auth_users where auth_users.id = auth.uid()),
      authenticated_email
    )
  )
  on conflict (id) do update set email = excluded.email;

  insert into public.company_users(company_id, user_id, branch_id, role)
  values (invite_row.company_id, auth.uid(), invite_row.branch_id, invite_row.role)
  on conflict on constraint company_users_pkey
  do update set branch_id = excluded.branch_id, role = excluded.role;

  update public.invitations
  set status = 'accepted', accepted_at = now(), revoked_at = null
  where invitations.id = invite_row.id;

  return query select invite_row.company_id, invite_row.branch_id, invite_row.role;
end;
$$;

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
  set driver_id = p_driver_id, position = v_target_next_position, updated_version = coalesce(target_route.updated_version, 0) + 1
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

revoke all on function public.claim_team_invitation(uuid) from public;
grant execute on function public.claim_team_invitation(uuid) to authenticated;
revoke all on function public.reassign_upcoming_route(uuid, uuid) from public;
grant execute on function public.reassign_upcoming_route(uuid, uuid) to authenticated;
