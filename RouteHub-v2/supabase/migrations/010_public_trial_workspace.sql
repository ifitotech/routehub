-- Public Manager request flow with immediate seven-day access.
-- Run after migrations 003, 004, 006 and 007.
-- This is additive and leaves existing companies, users and approvals unchanged.

alter table public.platform_manager_approvals add column if not exists requester_name text;
alter table public.platform_manager_approvals add column if not exists phone text;
alter table public.platform_manager_approvals add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.platform_manager_approvals add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.platform_manager_approvals add column if not exists trial_started_at timestamptz;
alter table public.platform_manager_approvals add column if not exists trial_ends_at timestamptz;
alter table public.platform_manager_approvals alter column approved_by drop not null;

create index if not exists platform_manager_approvals_company_idx on public.platform_manager_approvals(company_id);
create index if not exists platform_manager_approvals_trial_idx on public.platform_manager_approvals(status, trial_ends_at);

create or replace function public.create_trial_workspace(
  requester_name text,
  requester_company text,
  requester_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  clean_name text := nullif(trim(requester_name), '');
  clean_company text := nullif(trim(requester_company), '');
  clean_phone text := nullif(trim(coalesce(requester_phone, '')), '');
  workspace_company_id uuid;
  workspace_branch_id uuid;
  existing_company_id uuid;
  existing_branch_id uuid;
  trial_end timestamptz := now() + interval '7 days';
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a trial workspace';
  end if;
  if clean_name is null or clean_company is null then
    raise exception 'Name and company name are required';
  end if;

  select email into current_email from auth.users where id = current_user_id;
  if current_email is null then
    raise exception 'Unable to identify the signed-in email';
  end if;
  current_email := lower(trim(current_email));
  perform pg_advisory_xact_lock(hashtext(current_email));

  select company_id, branch_id into existing_company_id, existing_branch_id
  from public.company_users
  where user_id = current_user_id
  limit 1;

  if existing_company_id is not null then
    return jsonb_build_object('company_id', existing_company_id, 'branch_id', existing_branch_id, 'existing', true);
  end if;

  if exists (select 1 from public.platform_manager_approvals where lower(email) = current_email) then
    raise exception 'This email has already used its RouteHub trial';
  end if;

  insert into public.users(id, email, name)
  values (current_user_id, current_email, clean_name)
  on conflict (id) do update set email = excluded.email, name = excluded.name;

  insert into public.companies(name, plan, subscription_status, trial_ends_at, plan_started_at)
  values (clean_company, 'pro', 'trialing', trial_end, now())
  returning id into workspace_company_id;

  insert into public.branches(company_id, name)
  values (workspace_company_id, 'Main branch')
  returning id into workspace_branch_id;

  insert into public.company_users(company_id, user_id, branch_id, role)
  values (workspace_company_id, current_user_id, workspace_branch_id, 'branch_manager');

  insert into public.company_settings(company_id, language, theme)
  values (workspace_company_id, 'en', 'light')
  on conflict (company_id) do nothing;

  insert into public.platform_manager_approvals(
    email, company_name, requester_name, phone, company_id, branch_id,
    status, trial_started_at, trial_ends_at
  ) values (
    current_email, clean_company, clean_name, clean_phone, workspace_company_id, workspace_branch_id,
    'pending', now(), trial_end
  );

  insert into public.activity_logs(company_id, user_id, action, after_value)
  values (workspace_company_id, current_user_id, 'trial_workspace_created', jsonb_build_object('trial_ends_at', trial_end));

  return jsonb_build_object('company_id', workspace_company_id, 'branch_id', workspace_branch_id, 'trial_ends_at', trial_end, 'existing', false);
end;
$$;

revoke all on function public.create_trial_workspace(text, text, text) from public;
grant execute on function public.create_trial_workspace(text, text, text) to authenticated;
