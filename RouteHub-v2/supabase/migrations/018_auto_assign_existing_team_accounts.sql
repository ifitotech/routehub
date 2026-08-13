-- Existing RouteHub accounts are assigned immediately when a Manager invites
-- them. New emails remain pending until the person creates/signs into an
-- account, at which point claim_my_pending_invitation() links the membership.
-- Run after 016_link_invited_account.sql.

create or replace function public.create_team_invitation(invited_email text, invited_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_membership public.company_users%rowtype;
  invitation_id uuid;
  normalized_email text := lower(trim(invited_email));
  existing_auth_user_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if normalized_email = '' then raise exception 'Email is required'; end if;
  if invited_role not in ('branch_manager','operations_manager','sales_representative','counter_sales','driver') then
    raise exception 'Unsupported role';
  end if;

  select membership.* into manager_membership
  from public.company_users membership
  where membership.user_id = auth.uid()
    and membership.role in ('branch_manager','operations_manager')
  order by case when membership.role = 'branch_manager' then 0 else 1 end
  limit 1;
  if manager_membership.company_id is null then raise exception 'Manager access required'; end if;

  select id into existing_auth_user_id
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  select invitation.id into invitation_id
  from public.invitations invitation
  where invitation.company_id = manager_membership.company_id
    and lower(invitation.email) = normalized_email
  order by invitation.created_at desc
  limit 1;

  if invitation_id is null then
    insert into public.invitations(company_id, branch_id, email, role, status, invited_by, created_by, token_hash)
    values (manager_membership.company_id, manager_membership.branch_id, normalized_email, invited_role,
      case when existing_auth_user_id is null then 'pending' else 'accepted' end,
      auth.uid(), auth.uid(), md5(gen_random_uuid()::text || clock_timestamp()::text))
    returning id into invitation_id;
  else
    update public.invitations
    set role = invited_role,
        branch_id = manager_membership.branch_id,
        invited_by = coalesce(invited_by, auth.uid()),
        created_by = coalesce(created_by, auth.uid()),
        revoked_at = null,
        status = case when existing_auth_user_id is null then 'pending' else 'accepted' end,
        accepted_at = case when existing_auth_user_id is null then null else now() end
    where id = invitation_id;
  end if;

  if existing_auth_user_id is not null then
    insert into public.users(id, email, name)
    values (existing_auth_user_id, normalized_email,
      coalesce((select raw_user_meta_data ->> 'full_name' from auth.users where id = existing_auth_user_id), normalized_email))
    on conflict (id) do update set email = excluded.email;

    insert into public.company_users(company_id, user_id, branch_id, role)
    values (manager_membership.company_id, existing_auth_user_id, manager_membership.branch_id, invited_role)
    on conflict (company_id, user_id)
    do update set branch_id = excluded.branch_id, role = excluded.role;
  end if;

  return invitation_id;
end;
$$;

revoke all on function public.create_team_invitation(text, text) from public;
grant execute on function public.create_team_invitation(text, text) to authenticated;
