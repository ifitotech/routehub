-- Driver Mode invariant: an assigned person can execute only one active
-- route at a time. This is additive: it prevents new conflicting transitions
-- without changing historical rows or weakening any RLS policy.

create or replace function public.enforce_one_active_route_per_driver()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lock bigint;
begin
  if new.status <> 'active' or new.driver_id is null then
    return new;
  end if;

  -- Serialize competing Start route requests for the same person. The lock
  -- covers all company/date queues because a person cannot drive two routes
  -- concurrently, even if an old route was scheduled on another date.
  v_lock := hashtextextended(concat_ws('|', new.company_id::text, new.driver_id::text), 0);
  perform pg_advisory_xact_lock(v_lock);

  if exists (
    select 1
    from public.routes existing_route
    where existing_route.company_id = new.company_id
      and existing_route.driver_id = new.driver_id
      and existing_route.status = 'active'
      and existing_route.id <> new.id
  ) then
    raise exception 'A driver can have only one active route at a time.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_one_active_route_per_driver on public.routes;
create trigger enforce_one_active_route_per_driver
before insert or update of status, driver_id, company_id on public.routes
for each row execute function public.enforce_one_active_route_per_driver();
