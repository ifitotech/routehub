# RouteHub database migrations

## Authority and safety

- `supabase/migrations` is the authoritative, immutable change history for RouteHub v2 after the original RouteHub base schema.
- Never rename, reorder, or edit a migration that may already have been applied. Correct behavior with a new additive migration.
- The repository contains two historical files with prefix `015`. Preserve both names. Apply `015_driving_sessions.sql` before `015_invitation_token_hash_compat.sql` when reconstructing the recorded order.
- The highest current prefix is `025`; the next safe unused prefix is **`026`**.
- The v2 migrations are additive and do not create all core tables. They assume an existing baseline containing at least `companies`, `branches`, `users`, `company_users`, `routes`, `contacts`, `requests`, and platform administration tables.

There is no canonical `RouteHub-v2/supabase/schema.sql`. The repository-level [`../supabase/schema.sql`](../supabase/schema.sql) is a legacy baseline snapshot from before the v2 migration history. It is missing later columns, functions, triggers, and RLS policies and is **not authoritative for the current database**. Do not apply it to an existing or production project. A fresh empty database still requires a reviewed baseline export before these additive migrations; do not infer that baseline from application code.

## Recorded order

| Migration | Purpose | Important dependency or note |
| --- | --- | --- |
| `001_routehub_v2_missions.sql` | Adds mission, priority, address, scheduling, queue/version fields and route evidence metadata. | Requires the original `routes` and membership tables. |
| `002_delivery_completion_evidence.sql` | Adds completion coordinates, accuracy, method, warning, timestamp, and photo path. | After `001`. |
| `003_manager_workspace.sql` | Creates/completes invitations and Manager invitation RLS. | Requires companies, branches, users, and company membership. |
| `004_company_billing_plans.sql` | Adds the dormant subscription/plan foundation. | Billing is not activated by the beta application. |
| `005_branch_premium_trial.sql` | Adds one optional premium trial per branch. | After branches. |
| `006_trial_claims_by_email.sql` | Prevents repeated trial claims by the same authenticated email. | After `005`; replaces its trial RPC. |
| `007_ceo_manager_approvals.sql` | Adds CEO-controlled Manager approval records and RLS. | Requires platform administrators. |
| `008_driver_assigned_route_updates.sql` | Adds route status constraint, assigned-Driver update RLS, and protected-field trigger. | After `001` and `002`. |
| `009_workspace_mutation_policies.sql` | Adds role-scoped contact and request mutation policies. | Requires contacts, requests, and company membership. |
| `010_public_trial_workspace.sql` | Adds immediate seven-day trial workspace creation. | After `003`, `004`, `006`, and `007`. |
| `011_branch_address.sql` | Adds editable branch address and branch access policies. | Requires branches and company membership. |
| `012_branch_phone.sql` | Adds editable branch phone. | After `011`/branches. |
| `013_contact_delete_policy.sql` | Adds company-scoped contact deletion for authorized managers. | Complements `009`. |
| `014_claim_team_invitation.sql` | Adds invitation creation and authenticated email claim RPCs. | After `003`. |
| `015_driving_sessions.sql` | Adds one active operational driving session per person, latest coordinate only, and RLS. | Historical duplicate prefix; apply first among the two `015` files. |
| `015_invitation_token_hash_compat.sql` | Adds invitation token-hash compatibility for legacy schemas. | Historical duplicate prefix; after `014`. |
| `016_link_invited_account.sql` | Links authenticated accounts to invitations across legacy invitation shapes. | After invitation migrations. |
| `017_invitation_retention.sql` | Adds manual cleanup of invitations revoked for more than 30 days. | Scheduling is optional and requires `pg_cron`; the cleanup RPC works without it. |
| `018_auto_assign_existing_team_accounts.sql` | Automatically links invitations for accounts that already exist. | After `016`. |
| `019_fix_invitation_acceptance.sql` | Binds invitation acceptance to authenticated email + invitation ID and preserves auto-claim. | Supersedes older acceptance RPC behavior. |
| `020_sync_team_members_and_route_drivers.sql` | Repairs invited memberships, exposes authorized roster reads, and synchronizes known accounts. | After `019`. |
| `021_atomic_route_ordering.sql` | Introduces atomic per-assignee ordering and reassignment RPCs. | Historical predecessor to queue-scoped `023`. |
| `022_driver_issue_resolution.sql` | Allows an assigned user to resolve their own issue while retaining protected fields. | Replaces the route update trigger from `008`. |
| `023_atomic_route_queue_reordering.sql` | Makes route ordering atomic within company + branch + route date + assignee and safely reassigns upcoming work. | Supersedes `021` for reorder calls. |
| `024_one_active_route_per_driver.sql` | Enforces at most one active route per assigned person. | After route status and execution policies. |
| `025_primary_driver_and_temporary_route_execution.sql` | Adds a branch Primary Driver, temporary team execution, scoped sessions, protected route writes, and privacy-oriented session cleanup. | After `015_driving_sessions`, `020`, `023`, and `024`. |

## Database feature map

- **Base auth and membership:** legacy repository schema; `003`, `007`, `010`, `020`, `025`.
- **Routes and completion:** `001`, `002`, `008`, `021`, `022`, `023`, `024`, `025`.
- **Route queue isolation and atomic reorder:** `023` (current); `021` is retained history.
- **Invitations:** `003`, `014`, `015_invitation_token_hash_compat`, `016`-`020`.
- **Driving sessions and operational location:** `015_driving_sessions`, `025`.
- **Primary Driver and temporary route execution:** `025`.
- **Contacts and requests RLS:** `009`, `013`.
- **Trials and dormant plan foundation:** `004`-`007`, `010`.
- **Branch profile:** `011`, `012`, `025`.
- **Evidence Storage and retention:** `001`, `002`, plus `supabase/storage-policies.sql` and `supabase/retention.sql` (manual support SQL, not numbered migrations).

## Fresh environment notes

1. Create a disposable Supabase project; never use production for setup experiments.
2. Obtain a reviewed baseline containing the core RouteHub tables. The legacy repository schema can explain table origins but is not a current canonical dump.
3. Apply every file above in the recorded order and by exact filename.
4. Apply `supabase/storage-policies.sql` after creating/reviewing the private evidence bucket.
5. Apply retention scheduling only after deciding the project policy and whether `pg_cron` is enabled.
6. Run the application validation commands and `BETA_CHECKLIST.md` against the disposable environment.

Until a sanitized canonical baseline export is committed, a completely empty Supabase project is **not guaranteed reproducible from this folder alone**. This is documented rather than hidden or "fixed" by rewriting historical migrations.
