-- Invitation retention: revoked invitations are removed after 30 days.
-- Accepted and pending invitations are deliberately retained.
-- Run this migration in the Supabase SQL Editor after 016_link_invited_account.sql.

create or replace function public.cleanup_revoked_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer;
begin
  delete from public.invitations
  where status = 'revoked'
    and revoked_at is not null
    and revoked_at < now() - interval '30 days';

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.cleanup_revoked_invitations() from public;

-- Optionally schedule this once per day when pg_cron is enabled in Supabase:
-- select cron.schedule('routehub-cleanup-revoked-invitations', '15 3 * * *',
--   $$select public.cleanup_revoked_invitations();$$);
