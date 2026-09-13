-- Admin could only tell a test branch from a real one by noticing an
-- @routehub.local member email - the CEO asked for an explicit switch
-- instead, set once when creating or editing a branch from Admin.
alter table public.branches add column if not exists is_test boolean not null default false;
