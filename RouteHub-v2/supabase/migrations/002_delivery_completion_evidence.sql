alter table public.routes add column if not exists completion_lat double precision;
alter table public.routes add column if not exists completion_lng double precision;
alter table public.routes add column if not exists completion_accuracy double precision;
alter table public.routes add column if not exists completion_distance_m double precision;
alter table public.routes add column if not exists completion_method text;
alter table public.routes add column if not exists completion_warning text;
alter table public.routes add column if not exists completed_at timestamptz;
alter table public.routes add column if not exists completion_photo_path text;
