-- One reminder per driver per operational day. The Edge Function reserves a
-- row before sending, which makes the 07:00 notification idempotent even
-- when daylight saving time requires two UTC cron candidates.
create table if not exists public.route_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  route_date date not null,
  route_count integer not null check (route_count > 0),
  delivered_at timestamptz not null default now(),
  unique (company_id, driver_id, route_date)
);

alter table public.route_reminder_deliveries enable row level security;
revoke all on table public.route_reminder_deliveries from anon, authenticated;

create extension if not exists pg_net;

-- `routehub_morning_reminder_secret`, `routehub_project_url`, and the
-- project publishable key are created
-- in Supabase Vault during deployment. No API or cron secret is committed.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'routehub-driver-morning-route-reminder';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  -- 11:00 UTC is 07:00 during EDT and 12:00 UTC is 07:00 during EST. The
  -- Edge Function confirms the actual America/New_York hour before sending.
  perform cron.schedule(
    'routehub-driver-morning-route-reminder',
    '0 11,12 * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'routehub_project_url') || '/functions/v1/send-route-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'routehub_publishable_key'),
          'x-routehub-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'routehub_morning_reminder_secret')
        ),
        body := jsonb_build_object('action', 'morning_reminder'),
        timeout_milliseconds := 10000
      );
    $cron$
  );
end;
$$;
