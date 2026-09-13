-- Companies already carry plan/subscription_status/trial_ends_at (004), but
-- nothing in the app could change them - the CEO's only lever was editing
-- rows directly in the Supabase dashboard. One admin-only RPC, matching the
-- existing platform_create_company / platform_update_company pattern.
create or replace function public.platform_update_company_billing(
  company_id uuid,
  plan text default null,
  subscription_status text default null,
  trial_ends_at timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.platform_admins where user_id = auth.uid()) then raise exception 'CEO access required'; end if;
  if not exists (select 1 from public.companies where id = company_id) then raise exception 'Company not found'; end if;
  update public.companies set
    plan = coalesce(nullif(trim(plan), ''), companies.plan),
    subscription_status = coalesce(nullif(trim(subscription_status), ''), companies.subscription_status),
    trial_ends_at = case when trial_ends_at is not null then trial_ends_at else companies.trial_ends_at end
  where id = company_id;
  insert into public.platform_audit_events(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'company_billing_updated', 'company', company_id, jsonb_build_object('plan', plan, 'subscription_status', subscription_status, 'trial_ends_at', trial_ends_at));
end; $$;
revoke all on function public.platform_update_company_billing(uuid, text, text, timestamptz) from public;
grant execute on function public.platform_update_company_billing(uuid, text, text, timestamptz) to authenticated;
