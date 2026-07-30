-- Reemplaza las políticas permisivas de rls.sql por permisos por rol.
drop policy if exists "members manage contacts" on contacts;
drop policy if exists "members manage requests" on requests;
drop policy if exists "members manage routes" on routes;
drop policy if exists "members manage stops" on route_stops;

create policy "read contacts by company" on contacts for select to authenticated using (exists (select 1 from company_users cu where cu.company_id=contacts.company_id and cu.user_id=auth.uid()));
create policy "operate contacts by role" on contacts for insert to authenticated with check (exists (select 1 from company_users cu where cu.company_id=contacts.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager','sales_representative','counter_sales')));
create policy "edit contacts by role" on contacts for update to authenticated using (exists (select 1 from company_users cu where cu.company_id=contacts.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager','sales_representative')));
create policy "read requests by company" on requests for select to authenticated using (exists (select 1 from company_users cu where cu.company_id=requests.company_id and cu.user_id=auth.uid()));
create policy "create requests by role" on requests for insert to authenticated with check (exists (select 1 from company_users cu where cu.company_id=requests.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager','sales_representative','counter_sales')));
create policy "edit requests by role" on requests for update to authenticated using (exists (select 1 from company_users cu where cu.company_id=requests.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager','sales_representative')));
create policy "read routes by company" on routes for select to authenticated using (exists (select 1 from company_users cu where cu.company_id=routes.company_id and cu.user_id=auth.uid()));
create policy "manage routes by role" on routes for all to authenticated using (exists (select 1 from company_users cu where cu.company_id=routes.company_id and cu.user_id=auth.uid() and cu.role in ('branch_manager','operations_manager','sales_representative')));
create policy "driver updates assigned stops" on route_stops for update to authenticated using (exists (select 1 from routes r where r.id=route_stops.route_id and r.driver_id=auth.uid()));
