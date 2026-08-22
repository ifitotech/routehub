-- Per-branch automatic driver-day cutoff. Additive and backward-compatible.
alter table public.branches
  add column if not exists auto_close_time time not null default '18:00';

comment on column public.branches.auto_close_time is
  'Local branch time after which an idle driving day may close automatically.';
