-- RouteHub: drivers work only their operational-day queue. Any assigned work
-- still unfinished on a later day becomes a manager-visible issue.

create or replace function public.escalate_expired_driver_routes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff_date date := (now() at time zone 'America/New_York')::date;
  v_escalated integer;
begin
  update public.routes r
  set status = 'issue',
      driver_note = concat_ws(
        E'\n',
        nullif(r.driver_note, ''),
        '[RouteHub] Automatically escalated: this assigned stop was not completed by the end of its operational day.'
      ),
      updated_version = coalesce(r.updated_version, 0) + 1
  where r.driver_id is not null
    and r.route_date < v_cutoff_date
    and r.status in ('draft', 'pending', 'published', 'active', 'paused');

  get diagnostics v_escalated = row_count;
  return v_escalated;
end;
$$;

revoke all on function public.escalate_expired_driver_routes() from public;

-- pg_cron is enabled in this project. 05:10 UTC is safely after the local
-- operational-date change in Miami in both standard and daylight time.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'routehub-escalate-expired-driver-routes';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'routehub-escalate-expired-driver-routes',
    '10 05 * * *',
    $cron$select public.escalate_expired_driver_routes();$cron$
  );
end;
$$;

notify pgrst, 'reload schema';
