-- RouteHub beta: normalize route location metadata without removing legacy fields.
-- This migration is additive and safe to run after 032 (or independently).
begin;

alter table if exists public.routes
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision,
  add column if not exists destination_location_source text,
  add column if not exists destination_location_external_id text;

-- 032 used destination_external_id. Keep it for backwards compatibility and
-- copy its values into the canonical column when both columns are present.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='routes' and column_name='destination_external_id') then
    update public.routes
      set destination_location_external_id = coalesce(destination_location_external_id, destination_external_id)
      where destination_location_external_id is null and destination_external_id is not null;
  end if;
end $$;

-- Older beta clients used dest_lat/dest_lng. Add them only when absent so old
-- clients remain readable, then backfill the canonical coordinates.
alter table if exists public.routes
  add column if not exists dest_lat double precision,
  add column if not exists dest_lng double precision;

update public.routes
  set destination_lat = coalesce(destination_lat, dest_lat),
      destination_lng = coalesce(destination_lng, dest_lng)
  where (destination_lat is null or destination_lng is null)
    and (dest_lat is not null or dest_lng is not null);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'routes_destination_location_coordinate_pair_check') then
    alter table public.routes add constraint routes_destination_location_coordinate_pair_check check (
      (destination_lat is null and destination_lng is null) or
      (destination_lat is not null and destination_lng is not null and destination_lat between -90 and 90 and destination_lng between -180 and 180)
    ) not valid;
  end if;
end $$;

comment on column public.routes.destination_location_external_id is 'Optional provider identifier for the selected destination (canonical).';
notify pgrst, 'reload schema';
commit;
