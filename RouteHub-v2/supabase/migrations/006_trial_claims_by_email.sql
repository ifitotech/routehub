-- A premium trial can be claimed only once per authenticated email.
create table if not exists public.premium_trial_claims (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  constraint premium_trial_claims_email_unique unique (email)
);
alter table public.premium_trial_claims enable row level security;
drop policy if exists "users read own trial claim" on public.premium_trial_claims;
create policy "users read own trial claim" on public.premium_trial_claims for select to authenticated using (user_id=auth.uid());
drop policy if exists "users create own trial claim" on public.premium_trial_claims;
create policy "users create own trial claim" on public.premium_trial_claims for insert to authenticated with check (user_id=auth.uid());

create or replace function public.start_branch_premium_trial(branch_uuid uuid)
returns public.branches language plpgsql security invoker as $$
declare updated_branch public.branches; account_email text;
begin
  select lower(email) into account_email from auth.users where id=auth.uid();
  if account_email is null then raise exception 'Authenticated email is required'; end if;
  if not exists (select 1 from public.company_users cu where cu.company_id=(select company_id from public.branches where id=branch_uuid) and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager')) then
    raise exception 'Only an authorized Manager can start a trial';
  end if;
  if exists (select 1 from public.premium_trial_claims where email=account_email) then raise exception 'This email has already used a premium trial'; end if;
  update public.branches set premium_trial_started_at=now(), premium_trial_ends_at=now()+interval '7 days', premium_trial_used=true where id=branch_uuid and premium_trial_used=false;
  if not found then raise exception 'Premium trial already used or branch not found'; end if;
  insert into public.premium_trial_claims(email,user_id,branch_id) values(account_email,auth.uid(),branch_uuid);
  select * into updated_branch from public.branches where id=branch_uuid; return updated_branch;
end $$;
