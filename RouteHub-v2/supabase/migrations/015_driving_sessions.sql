-- Live Route MVP: one active, visible driving session per person.
-- We intentionally keep only the latest coordinate; this is not a GPS history table.
create table if not exists public.driving_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  driver_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_accuracy double precision,
  last_updated_at timestamptz not null default now()
);

create unique index if not exists driving_sessions_one_active_per_driver
  on public.driving_sessions(driver_id) where status = 'active';
create index if not exists driving_sessions_company_status_idx
  on public.driving_sessions(company_id, status);
create index if not exists driving_sessions_branch_status_idx
  on public.driving_sessions(branch_id, status);

alter table public.driving_sessions enable row level security;

drop policy if exists "driving sessions visible to company" on public.driving_sessions;
create policy "driving sessions visible to company"
  on public.driving_sessions for select to authenticated
  using (
    driver_id = auth.uid()
    or exists (
      select 1 from public.company_users viewer
      where viewer.company_id = driving_sessions.company_id
        and viewer.user_id = auth.uid()
        and viewer.role in ('branch_manager','operations_manager','admin','ceo')
        and (viewer.branch_id is null or driving_sessions.branch_id is null or viewer.branch_id = driving_sessions.branch_id)
    )
    or exists (select 1 from public.platform_admins platform where platform.user_id = auth.uid())
  );

drop policy if exists "drivers start own driving session" on public.driving_sessions;
create policy "drivers start own driving session"
  on public.driving_sessions for insert to authenticated
  with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.company_users member
      where member.company_id = driving_sessions.company_id
        and member.user_id = auth.uid()
        and member.role in ('driver','branch_manager','operations_manager','sales_representative','counter_sales')
    )
  );

drop policy if exists "drivers update own driving session" on public.driving_sessions;
create policy "drivers update own driving session"
  on public.driving_sessions for update to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());
