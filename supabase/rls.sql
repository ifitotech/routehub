-- Ejecutar después de schema.sql en Supabase.
alter table companies enable row level security;
alter table branches enable row level security;
alter table company_users enable row level security;
alter table contacts enable row level security;
alter table requests enable row level security;
alter table routes enable row level security;
alter table route_stops enable row level security;

create policy "members read own company" on companies for select to authenticated using (exists (select 1 from company_users cu where cu.company_id=companies.id and cu.user_id=auth.uid()));
create policy "members read own branches" on branches for select to authenticated using (exists (select 1 from company_users cu where cu.company_id=branches.company_id and cu.user_id=auth.uid()));
create policy "members read own users" on company_users for select to authenticated using (user_id=auth.uid() or exists (select 1 from company_users cu where cu.company_id=company_users.company_id and cu.user_id=auth.uid()));
create policy "members manage contacts" on contacts for all to authenticated using (exists (select 1 from company_users cu where cu.company_id=contacts.company_id and cu.user_id=auth.uid()));
create policy "members manage requests" on requests for all to authenticated using (exists (select 1 from company_users cu where cu.company_id=requests.company_id and cu.user_id=auth.uid()));
create policy "members manage routes" on routes for all to authenticated using (exists (select 1 from company_users cu where cu.company_id=routes.company_id and cu.user_id=auth.uid()));
create policy "members manage stops" on route_stops for all to authenticated using (exists (select 1 from routes r join company_users cu on cu.company_id=r.company_id where r.id=route_stops.route_id and cu.user_id=auth.uid()));
