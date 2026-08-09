-- RouteHub: editable branch phone number.
-- Safe to run more than once; existing branches keep their current data.
alter table public.branches
  add column if not exists phone text;

comment on column public.branches.phone is
  'Main phone number for the branch; editable by authorized managers.';

notify pgrst, 'reload schema';
