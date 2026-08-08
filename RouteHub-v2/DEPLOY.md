# RouteHub v2 deployment checklist

1. Copy `.env.example` to `.env.local` and add the Supabase URL and anon key.
2. Review `supabase/migrations/001_routehub_v2_missions.sql` in a staging project.
3. Confirm the existing `companies`, `company_users`, `routes` and `contacts` columns before applying it.
4. Run `npm install`, `npm run typecheck`, `npm run lint` and `npm run build`.
5. Configure the private `route-evidence` Storage bucket and its policies.
6. Test one CEO, Manager, Counter and Driver account separately.
7. Test the Driver on a real phone with GPS, camera, offline mode and signature.
8. Deploy only after the complete checklist passes.

The production RouteHub app is not changed by this project.
