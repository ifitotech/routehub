create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.platform_audit_events enable row level security;
drop policy if exists "platform admins read audit" on public.platform_audit_events;
create policy "platform admins read audit" on public.platform_audit_events for select to authenticated
using (exists (select 1 from public.platform_admins p where p.user_id = auth.uid()));

create or replace function public.platform_create_company(company_name text, branch_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_company_id uuid;
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then raise exception 'CEO access required'; end if;
  if nullif(trim(company_name), '') is null then raise exception 'Company name is required'; end if;
  insert into public.companies(name) values (trim(company_name)) returning id into new_company_id;
  insert into public.platform_audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'company_created', 'company', new_company_id, jsonb_build_object('branch_name', nullif(trim(branch_name), '')));
  return new_company_id;
end; $$;
revoke all on function public.platform_create_company(text, text) from public;
grant execute on function public.platform_create_company(text, text) to authenticated;

create or replace function public.platform_update_company(company_id uuid, company_name text, branch_name text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then raise exception 'CEO access required'; end if;
  if nullif(trim(company_name), '') is null then raise exception 'Company name is required'; end if;
  update public.companies set name = trim(company_name) where id = company_id;
  if not found then raise exception 'Company not found'; end if;
  insert into public.platform_audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'company_updated', 'company', company_id, jsonb_build_object('branch_name', nullif(trim(branch_name), '')));
end; $$;
revoke all on function public.platform_update_company(uuid, text, text) from public;
grant execute on function public.platform_update_company(uuid, text, text) to authenticated;
