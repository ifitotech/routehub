-- RouteHub: branch truck operations (fuel and maintenance).
-- Additive only; no existing route or driver behavior is changed.

create table if not exists public.trucks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  branch_id uuid not null,
  name text not null default 'Truck',
  make text,
  model text,
  year integer,
  plate_number text,
  current_odometer numeric(12,1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.truck_fuel_logs (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  company_id uuid not null,
  branch_id uuid not null,
  recorded_by uuid not null references auth.users(id),
  filled_at timestamptz not null default now(),
  odometer numeric(12,1) not null,
  amount numeric(10,2) not null,
  receipt_path text,
  created_at timestamptz not null default now(),
  constraint truck_fuel_logs_amount_positive check (amount >= 0),
  constraint truck_fuel_logs_odometer_positive check (odometer >= 0)
);

create table if not exists public.truck_maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id) on delete cascade,
  company_id uuid not null,
  branch_id uuid not null,
  recorded_by uuid not null references auth.users(id),
  serviced_at timestamptz not null default now(),
  maintenance_type text not null,
  odometer numeric(12,1),
  amount numeric(10,2),
  receipt_path text,
  created_at timestamptz not null default now(),
  constraint truck_maintenance_logs_odometer_positive check (odometer is null or odometer >= 0),
  constraint truck_maintenance_logs_amount_positive check (amount is null or amount >= 0)
);

create index if not exists trucks_scope_idx on public.trucks(company_id, branch_id, active);
create index if not exists truck_fuel_logs_scope_idx on public.truck_fuel_logs(company_id, branch_id, filled_at desc);
create index if not exists truck_maintenance_logs_scope_idx on public.truck_maintenance_logs(company_id, branch_id, serviced_at desc);

alter table public.trucks enable row level security;
alter table public.truck_fuel_logs enable row level security;
alter table public.truck_maintenance_logs enable row level security;

create policy "Members can view branch trucks" on public.trucks for select to authenticated
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = trucks.company_id and (cu.branch_id is null or cu.branch_id = trucks.branch_id)));
create policy "Managers can manage branch trucks" on public.trucks for all to authenticated
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = trucks.company_id and cu.role in ('branch_manager','operations_manager') and (cu.branch_id is null or cu.branch_id = trucks.branch_id)))
  with check (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = trucks.company_id and cu.role in ('branch_manager','operations_manager') and (cu.branch_id is null or cu.branch_id = trucks.branch_id)));

create policy "Members can view truck fuel" on public.truck_fuel_logs for select to authenticated
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = truck_fuel_logs.company_id and (cu.branch_id is null or cu.branch_id = truck_fuel_logs.branch_id)));
create policy "Drivers and managers can add truck fuel" on public.truck_fuel_logs for insert to authenticated
  with check (recorded_by = auth.uid() and exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = truck_fuel_logs.company_id and cu.role in ('driver','branch_manager','operations_manager') and (cu.branch_id is null or cu.branch_id = truck_fuel_logs.branch_id)));

create policy "Members can view truck maintenance" on public.truck_maintenance_logs for select to authenticated
  using (exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = truck_maintenance_logs.company_id and (cu.branch_id is null or cu.branch_id = truck_maintenance_logs.branch_id)));
create policy "Drivers and managers can add truck maintenance" on public.truck_maintenance_logs for insert to authenticated
  with check (recorded_by = auth.uid() and exists (select 1 from public.company_users cu where cu.user_id = auth.uid() and cu.company_id = truck_maintenance_logs.company_id and cu.role in ('driver','branch_manager','operations_manager') and (cu.branch_id is null or cu.branch_id = truck_maintenance_logs.branch_id)));

notify pgrst, 'reload schema';
