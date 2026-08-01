-- Safe incremental migration. Run after schema.sql and dynamic_route_planner.sql.
-- Branch setup and route creation use this address as the default origin.
alter table branches add column if not exists address text;

create index if not exists idx_branches_company on branches(company_id);
