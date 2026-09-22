-- Pilot hardening: every RPC in this application obtains its authority from
-- auth.uid() and is called after sign-in. Do not leave SECURITY DEFINER
-- functions reachable through the anonymous Data API role.
--
-- `PUBLIC` is important here: PostgreSQL grants EXECUTE to PUBLIC by default,
-- so revoking only `anon` would still leave a route through that implicit
-- grant. Authenticated users retain access; individual functions still check
-- their company/role inside the function body.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Keep newly created public RPCs closed to anonymous callers by default.
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public grant execute on functions to authenticated, service_role;
