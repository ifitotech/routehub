-- One premium trial per branch. The trial is optional and starts only when activated.
alter table public.branches add column if not exists premium_trial_started_at timestamptz;
alter table public.branches add column if not exists premium_trial_ends_at timestamptz;
alter table public.branches add column if not exists premium_trial_used boolean not null default false;
create index if not exists branches_premium_trial_idx on public.branches(premium_trial_used, premium_trial_ends_at);

create or replace function public.start_branch_premium_trial(branch_uuid uuid)
returns public.branches language plpgsql security invoker as $$
declare updated_branch public.branches;
begin
  update public.branches
  set premium_trial_started_at=now(), premium_trial_ends_at=now()+interval '7 days', premium_trial_used=true
  where id=branch_uuid and premium_trial_used=false;
  if not found then raise exception 'Premium trial already used or branch not found'; end if;
  select * into updated_branch from public.branches where id=branch_uuid;
  return updated_branch;
end $$;
