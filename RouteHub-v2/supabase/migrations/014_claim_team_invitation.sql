-- Connect an existing authenticated account to the company that invited it.
-- Safe to run more than once. The authenticated email must match the invite.
create or replace function public.create_team_invitation(invited_email text, invited_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_membership public.company_users%rowtype;
  invitation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if lower(trim(invited_email)) = '' then
    raise exception 'Email is required';
  end if;
  if invited_role not in ('branch_manager','operations_manager','sales_representative','counter_sales','driver') then
    raise exception 'Unsupported role';
  end if;

  select membership.* into manager_membership
  from public.company_users membership
  where membership.user_id=auth.uid()
    and membership.role in ('branch_manager','operations_manager')
  order by case when membership.role='branch_manager' then 0 else 1 end
  limit 1;

  if manager_membership.company_id is null then
    raise exception 'Manager access required';
  end if;

  select invitation.id into invitation_id
  from public.invitations invitation
  where invitation.company_id=manager_membership.company_id
    and lower(invitation.email)=lower(trim(invited_email))
    and invitation.status='pending'
  order by invitation.created_at desc
  limit 1;

  if invitation_id is null then
    insert into public.invitations(company_id,branch_id,email,role,status,created_by)
    values(manager_membership.company_id,manager_membership.branch_id,lower(trim(invited_email)),invited_role,'pending',auth.uid())
    returning id into invitation_id;
  else
    update public.invitations
    set role=invited_role,branch_id=manager_membership.branch_id,revoked_at=null
    where id=invitation_id;
  end if;

  return invitation_id;
end;
$$;

create or replace function public.claim_my_pending_invitation()
returns table(company_id uuid, branch_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.invitations%rowtype;
  authenticated_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  authenticated_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if authenticated_email = '' then
    return;
  end if;

  select invitation.* into invite_row
  from public.invitations invitation
  where lower(invitation.email) = authenticated_email
    and invitation.status = 'pending'
    and invitation.revoked_at is null
    and invitation.role in ('branch_manager','operations_manager','sales_representative','counter_sales','driver')
  order by invitation.created_at desc
  limit 1
  for update skip locked;

  if invite_row.id is null then
    return;
  end if;

  insert into public.company_users(company_id, user_id, branch_id, role)
  values(invite_row.company_id, auth.uid(), invite_row.branch_id, invite_row.role)
  on conflict (company_id, user_id)
  do update set branch_id=excluded.branch_id, role=excluded.role;

  update public.invitations
  set status='accepted'
  where id=invite_row.id;

  return query select invite_row.company_id, invite_row.branch_id, invite_row.role;
end;
$$;

revoke all on function public.claim_my_pending_invitation() from public;
grant execute on function public.claim_my_pending_invitation() to authenticated;
revoke all on function public.create_team_invitation(text,text) from public;
grant execute on function public.create_team_invitation(text,text) to authenticated;
