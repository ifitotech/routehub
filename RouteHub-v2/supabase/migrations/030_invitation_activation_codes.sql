-- Password setup is protected by a short-lived, one-time activation code.
-- It preserves existing beta accounts and invitation history.
alter table public.invitations add column if not exists activation_code_hash text;
alter table public.invitations add column if not exists activation_code_expires_at timestamptz;
alter table public.invitations add column if not exists activation_code_used_at timestamptz;

create index if not exists invitations_activation_lookup_idx
  on public.invitations (email, status, activation_code_expires_at desc);
