-- Fix invitation acceptance across the legacy RouteHub invitation schemas.
-- The token_hash column is retained for provider/legacy compatibility only.
-- Acceptance is intentionally bound to the authenticated email + invitation id.

alter table public.invitations add column if not exists accepted_at timestamptz;
alter table public.invitations add column if not exists expires_at timestamptz;

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

  select lower(email)
  into authenticated_email
  from auth.users
  where id = auth.uid();

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

  -- Existing RouteHub databases require a public profile before a company
  -- membership can be created.  Keep it synchronized with the Auth account.
  insert into public.users(id, email, name)
  values (
    auth.uid(),
    authenticated_email,
    coalesce(
      (select raw_user_meta_data ->> 'full_name' from auth.users where id = auth.uid()),
      authenticated_email
    )
  )
  on conflict (id) do update set email = excluded.email;

  insert into public.company_users(company_id, user_id, branch_id, role)
  values (invite_row.company_id, auth.uid(), invite_row.branch_id, invite_row.role)
  on conflict (company_id, user_id)
  do update set branch_id = excluded.branch_id, role = excluded.role;

  update public.invitations
  set status = 'accepted',
      accepted_at = now(),
      revoked_at = null
  where id = invite_row.id;

  raise log 'RouteHub invitation accepted: invitation %, user %, company %', invite_row.id, auth.uid(), invite_row.company_id;
  return query select invite_row.company_id, invite_row.branch_id, invite_row.role;
end;
$$;

-- Keep the old no-argument RPC working for login auto-claim. It only claims
-- the latest valid invitation for the authenticated account.
create or replace function public.claim_my_pending_invitation()
returns table(company_id uuid, branch_id uuid, role text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_id uuid;
  authenticated_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into authenticated_email from auth.users where id = auth.uid();
  if authenticated_email is null or authenticated_email = '' then
    return;
  end if;

  select id into target_id
  from public.invitations
  where lower(email) = authenticated_email
    and status = 'pending'
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if target_id is null then
    return;
  end if;

  return query select * from public.claim_team_invitation(target_id);
end;
$$;

revoke all on function public.claim_team_invitation(uuid) from public;
grant execute on function public.claim_team_invitation(uuid) to authenticated;
revoke all on function public.claim_my_pending_invitation() from public;
grant execute on function public.claim_my_pending_invitation() to authenticated;
