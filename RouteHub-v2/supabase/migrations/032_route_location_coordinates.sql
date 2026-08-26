-- Additive location metadata for RouteHub beta maps. All columns are nullable
-- so existing routes, contacts and branches remain fully compatible.
begin;

alter table public.routes
  add column if not exists origin_lat double precision,
  add column if not exists origin_lng double precision,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision,
  add column if not exists destination_location_source text,
  add column if not exists destination_external_id text;

alter table public.contacts
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_source text,
  add column if not exists location_external_id text;

alter table public.branches
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_source text,
  add column if not exists location_external_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'routes_origin_coordinate_pair_check') then
    alter table public.routes add constraint routes_origin_coordinate_pair_check check (
      (origin_lat is null and origin_lng is null) or
      (origin_lat is not null and origin_lng is not null and origin_lat between -90 and 90 and origin_lng between -180 and 180)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'routes_destination_coordinate_pair_check') then
    alter table public.routes add constraint routes_destination_coordinate_pair_check check (
      (destination_lat is null and destination_lng is null) or
      (destination_lat is not null and destination_lng is not null and destination_lat between -90 and 90 and destination_lng between -180 and 180)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contacts_coordinate_pair_check') then
    alter table public.contacts add constraint contacts_coordinate_pair_check check (
      (latitude is null and longitude is null) or
      (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'branches_coordinate_pair_check') then
    alter table public.branches add constraint branches_coordinate_pair_check check (
      (latitude is null and longitude is null) or
      (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
    ) not valid;
  end if;
end $$;

comment on column public.routes.destination_location_source is 'RouteHub location provider: routehub, census, nominatim or manual.';
comment on column public.routes.destination_external_id is 'Optional provider identifier for the selected destination.';

notify pgrst, 'reload schema';
commit;
