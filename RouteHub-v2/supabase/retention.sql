-- Retention policy: keep evidence metadata for 12 months and remove older files
-- through a scheduled Edge Function or Supabase Cron job.
create or replace view public.route_evidence_retention_candidates as
select id,storage_path,created_at
from public.route_evidence_v2
where created_at < now() - interval '12 months';

comment on view public.route_evidence_retention_candidates is
'Candidates for scheduled deletion from the private route-evidence bucket. Review legal requirements before enabling deletion.';
