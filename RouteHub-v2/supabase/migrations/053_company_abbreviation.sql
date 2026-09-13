-- Optional short abbreviation for an organization (e.g. "CES" for "City
-- Electric Supply") - lets branch codes and beta-account passwords stay
-- short instead of spelling out the full company name every time.
alter table public.companies add column if not exists abbreviation text;

create or replace function public.platform_create_company(company_name text, branch_name text default null, manager_name text default null, manager_email text default null, company_abbreviation text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_company_id uuid; new_branch_id uuid;
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then raise exception 'CEO access required'; end if;
  if nullif(trim(company_name), '') is null then raise exception 'Company name is required'; end if;
  insert into public.companies(name, default_branch_name, branch_manager_name, abbreviation) values (trim(company_name), nullif(trim(branch_name), ''), nullif(trim(manager_name), ''), nullif(upper(trim(company_abbreviation)), '')) returning id into new_company_id;
  insert into public.branches(company_id, name) values (new_company_id, coalesce(nullif(trim(branch_name), ''), 'Main branch')) returning id into new_branch_id;
  if nullif(trim(manager_email), '') is not null then
    insert into public.invitations(company_id, branch_id, email, role, status, created_by, invited_by)
      values (new_company_id, new_branch_id, lower(trim(manager_email)), 'branch_manager', 'pending', auth.uid(), auth.uid());
  end if;
  insert into public.platform_audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'company_created', 'company', new_company_id, jsonb_build_object('branch_name', nullif(trim(branch_name), '')));
  return new_company_id;
end; $$;
revoke all on function public.platform_create_company(text, text, text, text, text) from public;
grant execute on function public.platform_create_company(text, text, text, text, text) to authenticated;

create or replace function public.platform_update_company(company_id uuid, company_name text, branch_name text default null, manager_name text default null, company_abbreviation text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then raise exception 'CEO access required'; end if;
  if nullif(trim(company_name), '') is null then raise exception 'Company name is required'; end if;
  update public.companies set name = trim(company_name), default_branch_name = nullif(trim(branch_name), ''), branch_manager_name = nullif(trim(manager_name), ''), abbreviation = nullif(upper(trim(company_abbreviation)), '') where id = company_id;
  if not found then raise exception 'Company not found'; end if;
  insert into public.platform_audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'company_updated', 'company', company_id, jsonb_build_object('branch_name', nullif(trim(branch_name), '')));
end; $$;
revoke all on function public.platform_update_company(uuid, text, text, text, text) from public;
grant execute on function public.platform_update_company(uuid, text, text, text, text) to authenticated;
