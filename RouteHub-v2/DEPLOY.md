# RouteHub v2 deployment checklist

1. Copy `.env.example` to `.env.local` and configure the documented environment variable names without committing values.
2. Run `npm run check:env`.
3. Review `MIGRATIONS.md`; apply only unapplied additive migrations in the recorded order.
4. Never rename or rewrite an applied migration and never use the legacy repository `supabase/schema.sql` to reset an existing project.
5. Configure the private `route-evidence` Storage bucket with `supabase/storage-policies.sql`.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
7. Complete `BETA_CHECKLIST.md` with separate Manager, Primary Driver, and temporary Team Member accounts.
8. Verify company/branch isolation, queue isolation, route completion evidence, and operational-location privacy before deployment.
9. Confirm the intended Vercel project, Root Directory (`RouteHub-v2`), environment, and production domain before promoting the build.

