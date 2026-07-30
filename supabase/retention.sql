-- Retención configurable de evidencia. Ejecutar solo si pg_cron está habilitado.
create or replace function purge_expired_routehub_evidence() returns void language plpgsql security definer as $$
begin
  delete from stop_photos p where p.created_at < now() - interval '30 days';
  delete from stop_signatures s where s.created_at < now() - interval '30 days';
  delete from packing_lists p where p.created_at < now() - interval '30 days';
end; $$;

-- Programación opcional diaria (requiere extensión pg_cron):
-- select cron.schedule('routehub-evidence-retention','0 3 * * *','select purge_expired_routehub_evidence()');
