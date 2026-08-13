-- Ensure that an invitation always results in a visible team membership when
-- its email already belongs to an authenticated RouteHub account.  This is
-- safe to run repeatedly and repairs legacy pending invitations as well.

alter table public.invitations add column if not exists token_hash text;
alter table public.invitations add column if not exists invited_by uuid references auth.users(id);
alter table public.invitations add column if not exists created_by uuid references auth.users(id);
alter table public.invitations add column if not exists accepted_at timestamptz;
alter table public.invitations add column if not exists expires_at timestamptz;

-- The UI needs to show the roster to dispatch-capable members. A SECURITY
-- DEFINER helper avoids recursive RLS evaluation on company_users itself.
create or replace function public.can_read_company_roster(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_users membership
    where membership.company_id = target_company_id
      and membership.user_id = auth.uid()
      and membership.role in ('branch_manager','operations_manager','sales_representative')
  );
$$;

revoke all on function public.can_read_company_roster(uuid) from public;
grant execute on function public.can_read_company_roster(uuid) to authenticated;

alter table public.company_users enable row level security;
drop policy if exists "workspace members can read team roster" on public.company_users;
create policy "workspace members can read team roster"
on public.company_users for select to authenticated
using (
  user_id = auth.uid()
  or public.can_read_company_roster(company_id)
);

create or replace function public.create_team_invitation(invited_email text, invited_role text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  manager_membership public.company_users%rowtype;
  invitation_id uuid;
  existing_auth_user_id uuid;
  normalized_email text := lower(trim(invited_email));
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
    insert into public.invitations (
      company_id, branch_id, email, role, status, invited_by, created_by, token_hash, accepted_at, revoked_at
    ) values (
      manager_membership.company_id, manager_membership.branch_id, normalized_email, invited_role,
      case when existing_auth_user_id is null then 'pending' else 'accepted' end,
      auth.uid(), auth.uid(), md5(gen_random_uuid()::text || clock_timestamp()::text),
      case when existing_auth_user_id is null then null else now() end, null
    ) returning id into invitation_id;
  else
    update public.invitations
    set role = invited_role,
        branch_id = manager_membership.branch_id,
        invited_by = coalesce(invited_by, auth.uid()),
        created_by = coalesce(created_by, auth.uid()),
        token_hash = coalesce(token_hash, md5(gen_random_uuid()::text || clock_timestamp()::text)),
        revoked_at = null,
        status = case when existing_auth_user_id is null then 'pending' else 'accepted' end,
        accepted_at = case when existing_auth_user_id is null then null else now() end
    where id = invitation_id;
  end if;

  if existing_auth_user_id is not null then
    insert into public.users(id, email, name)
    values (
      existing_auth_user_id,
      normalized_email,
      coalesce((select raw_user_meta_data ->> 'full_name' from auth.users where id = existing_auth_user_id), normalized_email)
    )
    on conflict (id) do update set email = excluded.email;

    insert into public.company_users(company_id, user_id, branch_id, role)
    values (manager_membership.company_id, existing_auth_user_id, manager_membership.branch_id, invited_role)
    on conflict (company_id, user_id)
    do update set branch_id = excluded.branch_id, role = excluded.role;
  end if;

  return invitation_id;
end;
$$;

-- Repair all unrevoked invitations for accounts that already exist in Auth.
insert into public.users(id, email, name)
select account.id, lower(account.email), coalesce(account.raw_user_meta_data ->> 'full_name', lower(account.email))
from public.invitations invitation
join auth.users account on lower(account.email) = lower(invitation.email)
where invitation.revoked_at is null
  and invitation.status in ('pending', 'accepted')
on conflict (id) do update set email = excluded.email;

insert into public.company_users(company_id, user_id, branch_id, role)
select invitation.company_id, account.id, invitation.branch_id, invitation.role
from public.invitations invitation
join auth.users account on lower(account.email) = lower(invitation.email)
where invitation.revoked_at is null
  and invitation.status in ('pending', 'accepted')
  and invitation.role in ('branch_manager','operations_manager','sales_representative','counter_sales','driver')
on conflict (company_id, user_id)
do update set branch_id = excluded.branch_id, role = excluded.role;

update public.invitations invitation
set status = 'accepted', accepted_at = coalesce(invitation.accepted_at, now())
where invitation.revoked_at is null
  and invitation.status = 'pending'
  and exists (select 1 from auth.users account where lower(account.email) = lower(invitation.email));

revoke all on function public.create_team_invitation(text, text) from public;
grant execute on function public.create_team_invitation(text, text) to authenticated;
