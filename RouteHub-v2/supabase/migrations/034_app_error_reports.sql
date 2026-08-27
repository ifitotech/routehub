begin;
create table if not exists public.app_error_reports(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 branch_id uuid references public.branches(id) on delete set null,
 user_id uuid not null references public.users(id) on delete cascade,
 route_id uuid references public.routes(id) on delete set null,
 action text not null,
 error_message text not null,
 context jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create index if not exists app_error_reports_company_created_idx on public.app_error_reports(company_id,created_at desc);
alter table public.app_error_reports enable row level security;
drop policy if exists "Members can create app error reports" on public.app_error_reports;
create policy "Members can create app error reports" on public.app_error_reports for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.company_users cu where cu.company_id=app_error_reports.company_id and cu.user_id=auth.uid()));
drop policy if exists "Members can view app error reports" on public.app_error_reports;
create policy "Members can view app error reports" on public.app_error_reports for select to authenticated using (exists(select 1 from public.company_users cu where cu.company_id=app_error_reports.company_id and cu.user_id=auth.uid()));
commit;
