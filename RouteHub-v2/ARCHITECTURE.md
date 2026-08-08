# RouteHub v2 architecture

## Boundaries

- `app/`: screens and role workspaces only.
- `lib/`: permissions, Supabase services, planner logic, GPS, offline queue and evidence.
- `supabase/`: additive migrations, Storage policies and retention scripts.
- `public/`: PWA manifest, service worker and static assets.

## Extension rules

1. Add new roles to `lib/types.ts` and `lib/permissions.ts` first.
2. Add database columns only through additive migrations.
3. Keep mission logic pure in `lib/planner.ts`.
4. Keep Supabase queries in `lib/data.ts`, not inside visual components.
5. Never expose private Storage files with public URLs.
6. Run typecheck, lint and build before every deployment.
