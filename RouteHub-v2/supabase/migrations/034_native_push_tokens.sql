create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android','ios')),
  token text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, platform, token)
);
alter table public.native_push_tokens enable row level security;
create policy "Users manage own native push tokens" on public.native_push_tokens
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
