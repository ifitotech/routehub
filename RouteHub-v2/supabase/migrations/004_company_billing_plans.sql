-- Subscription foundation for Free, Plus, Pro and Enterprise.
-- Safe to run on an existing companies table.
alter table public.companies add column if not exists plan text not null default 'free';
alter table public.companies add column if not exists subscription_status text not null default 'trialing';
alter table public.companies add column if not exists trial_ends_at timestamptz default (now() + interval '7 days');
alter table public.companies add column if not exists plan_started_at timestamptz;
alter table public.companies add column if not exists max_drivers integer not null default 1;
alter table public.companies add column if not exists max_contacts integer not null default 25;
alter table public.companies add column if not exists monthly_route_limit integer not null default 30;
alter table public.companies add column if not exists stripe_customer_id text;
alter table public.companies add column if not exists stripe_subscription_id text;
create index if not exists companies_subscription_status_idx on public.companies(subscription_status);
create index if not exists companies_stripe_customer_idx on public.companies(stripe_customer_id);

create or replace function public.apply_routehub_plan_limits()
returns trigger language plpgsql as $$
begin
  if new.plan = 'plus' then new.max_drivers := 1; new.max_contacts := 250; new.monthly_route_limit := 1000;
  elsif new.plan = 'pro' then new.max_drivers := 5; new.max_contacts := 2500; new.monthly_route_limit := 5000;
  elsif new.plan = 'enterprise' then new.max_drivers := 100; new.max_contacts := 100000; new.monthly_route_limit := 100000;
  else new.max_drivers := 1; new.max_contacts := 25; new.monthly_route_limit := 30;
  end if;
  return new;
end $$;
drop trigger if exists companies_plan_limits on public.companies;
create trigger companies_plan_limits before insert or update of plan on public.companies for each row execute function public.apply_routehub_plan_limits();
