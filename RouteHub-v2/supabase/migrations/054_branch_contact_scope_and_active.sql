-- Two fixes, same root cause: platform_create_branch auto-creates a
-- "return to this branch" contact for every new branch, but never scoped
-- it to that branch - it always landed as a company-wide contact
-- (branch_id null), so it showed up in every other branch's destination
-- search too (e.g. "EAST HIALEAH" suggested while working Opa Locka).

-- Backfill: link each existing branch-shaped contact back to its branch
-- by exact company_id + name match, so already-created branches stop
-- leaking into every other branch's contact list too.
update public.contacts c
set branch_id = b.id
from public.branches b
where c.branch_id is null
  and c.company_id = b.company_id
  and c.company_name = b.name;

-- A branch a CEO just created isn't necessarily open for business yet -
-- not every store is enabled at once. New branches start inactive by
-- default (the client explicitly opts a branch in); existing branches
-- already in use are left active so nothing already running goes dark.
alter table public.branches add column if not exists active boolean not null default true;

create or replace function public.platform_create_branch(company_id uuid, branch_name text, branch_number text, branch_address text, manager_email text, branch_active boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_branch_id uuid;
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then raise exception 'CEO access required'; end if;
  if not exists (select 1 from public.companies where id = company_id) then raise exception 'Company not found'; end if;
  if nullif(trim(branch_name), '') is null then raise exception 'Branch name is required'; end if;
  insert into public.branches(company_id, name, branch_number, address, active) values (company_id, trim(branch_name), nullif(trim(branch_number), ''), nullif(trim(branch_address), ''), branch_active) returning id into new_branch_id;
  insert into public.contacts(company_id, branch_id, company_name, address, location_code)
    values (company_id, new_branch_id, trim(branch_name), nullif(trim(branch_address), ''), nullif(trim(branch_number), ''));
  if nullif(trim(manager_email), '') is not null then
    insert into public.invitations(company_id, branch_id, email, role, status, created_by, invited_by)
      values (company_id, new_branch_id, lower(trim(manager_email)), 'branch_manager', 'pending', auth.uid(), auth.uid());
  end if;
  insert into public.platform_audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'branch_created', 'branch', new_branch_id, jsonb_build_object('company_id', company_id, 'manager_email', nullif(lower(trim(manager_email)), '')));
  return new_branch_id;
end; $$;
revoke all on function public.platform_create_branch(uuid, text, text, text, text, boolean) from public;
grant execute on function public.platform_create_branch(uuid, text, text, text, text, boolean) to authenticated;

-- The old 5-argument signature is still called from a couple of client
-- paths that don't yet pass branch_active - keep it working (new branches
-- through that path stay inactive by default) instead of breaking them.
create or replace function public.platform_create_branch(company_id uuid, branch_name text, branch_number text, branch_address text, manager_email text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return public.platform_create_branch(company_id, branch_name, branch_number, branch_address, manager_email, false);
end; $$;
revoke all on function public.platform_create_branch(uuid, text, text, text, text) from public;
grant execute on function public.platform_create_branch(uuid, text, text, text, text) to authenticated;
