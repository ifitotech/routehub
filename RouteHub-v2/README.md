# RouteHub v2

RouteHub is a role-based pickup and delivery operations application. The beta is optimized for a simple operating model:

```text
Company -> Branch -> Primary Driver -> Daily routes
```

An authorized team member can also receive a temporary route assignment without changing their permanent role or becoming a permanent Driver.

## Core beta workflow

1. A Manager creates and assigns a pickup, delivery, or return-to-branch route.
2. The Primary Driver is the default assignee for their branch.
3. The Manager can explicitly assign one route to an authorized team member.
4. Upcoming work is ordered within an isolated company + branch + date + assignee queue.
5. The assignee starts, completes, or reports the route using the Driver execution workspace.
6. Driving sessions keep only the latest operational coordinate; RouteHub does not store GPS history.

## Local development

Requirements: Node.js 20+, npm, and a Supabase project containing the RouteHub base tables.

```powershell
Copy-Item .env.example .env.local
npm install
npm run check:env
npm run dev
```

Validation commands:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

## Environment variables

Configure values locally or in the deployment environment. Never commit production values.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional Google Places integration:

- `NEXT_PUBLIC_ADDRESS_SEARCH_PROVIDER` - set to `google` only when Google Places is intentionally enabled; otherwise RouteHub uses the beta server-side address fallback.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - browser-restricted Google Maps key used only when the provider above is `google`.

The Google key is exposed to the browser by design and therefore must be restricted in Google Cloud by the allowed RouteHub HTTP referrers and required APIs.

## Supabase setup

- Additive migrations live in [`supabase/migrations`](supabase/migrations).
- Apply them in the exact order documented in [`MIGRATIONS.md`](MIGRATIONS.md).
- The migrations assume the original RouteHub base tables already exist; they are not currently a standalone empty-database bootstrap.
- [`../supabase/schema.sql`](../supabase/schema.sql) is a legacy baseline snapshot, not the authoritative current schema. Do not use it to reset or patch production.
- `supabase/storage-policies.sql` configures the private `route-evidence` bucket.
- `supabase/retention.sql` identifies evidence metadata eligible for retention cleanup.

Never rename or rewrite a migration that may already have been applied. Add all future database changes with the next unused prefix documented in `MIGRATIONS.md`.

## Beta verification

Run the practical branch workflow in [`BETA_CHECKLIST.md`](BETA_CHECKLIST.md) before testing with a real branch or deploying a database change.

## Project boundaries

- `app/`: role workspaces and UI.
- `lib/`: permissions, route queues, planner logic, Supabase services, and operational location helpers.
- `supabase/`: additive migrations, Storage policies, and retention support.
- `tests/`: focused business-rule and migration contract tests.
- `public/`: PWA assets and service worker resources.
