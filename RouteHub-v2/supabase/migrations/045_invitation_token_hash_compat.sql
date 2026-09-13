-- Ensure legacy invitation rows can be created on projects where token_hash
-- is required. The app never exposes this value; it is only a non-reversible
-- compatibility token for invitation providers and older schemas.
alter table public.invitations
  add column if not exists token_hash text;

update public.invitations
set token_hash = md5(coalesce(id::text, '') || coalesce(email, '') || clock_timestamp()::text)
where token_hash is null;

alter table public.invitations
  alter column token_hash set default md5(gen_random_uuid()::text || clock_timestamp()::text);

alter table public.invitations
  alter column token_hash set not null;
