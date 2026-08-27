-- Allow assigned drivers to save recipient notes, signatures and finalization metadata.
-- Additive replacement of the protected-field trigger; historical migrations remain unchanged.
create or replace function public.enforce_assigned_driver_route_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_is_dispatch boolean;
  allowed_columns text[] := array[
    'status','updated_version','completed_at','completion_lat','completion_lng',
    'completion_accuracy','completion_distance_m','completion_method',
    'completion_warning','completion_photo_path','notes','driver_confirmed_at',
    'driver_note','customer_signature_path','finalized_at','finalization_method',
    'finalization_note','finalization_issue','finalization_photo_path'
  ];
begin
  if actor is null or old.driver_id is distinct from actor then
    return new;
  end if;

  select exists (
    select 1 from public.company_users cu
    where cu.user_id = actor
      and cu.company_id = old.company_id
      and cu.role in ('branch_manager','operations_manager','sales_representative')
  ) into actor_is_dispatch;

  if actor_is_dispatch then
    return new;
  end if;

  if (to_jsonb(new) - allowed_columns) is distinct from (to_jsonb(old) - allowed_columns) then
    raise exception 'Drivers may only update route progress, evidence, GPS, and issue notes.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not (
    (old.status in ('draft','pending','published') and new.status = 'active')
    or (old.status = 'active' and new.status in ('paused','completed','issue'))
    or (old.status = 'paused' and new.status in ('active','completed','issue'))
  ) then
    raise exception 'Invalid driver route status transition: % to %.', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

