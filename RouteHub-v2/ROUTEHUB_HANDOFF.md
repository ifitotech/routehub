# RouteHub Handoff

## Current State (updated 12 Sep 2026, Claude Sonnet 5)
`/driver` remains the official Driver entry (middleware rewrites every `/driver/*` request to `/driver-v3/*`; the old `app/driver/` tree is physically unreachable fallback code — never edit it). Manager's Dashboard, Settings, Team, Truck, and the merged History+Reports page have all had a mobile-responsiveness and duplication audit this session — see `CHATGPT_HANDOFF.md`'s "12 Sep 2026 session" section for the full list, it's long and this file intentionally doesn't repeat it. Admin (`/admin/*`) went from a handful of disconnected pages to an actual platform control panel with a shared nav shell, real Billing, automatic Errors capture, a Support inbox, and Platform-admin management.

## Last Work Completed
Driver v3 cleanup: fixed the bottom nav highlighting two tabs at once on certain sub-screens, then found and deleted three fully orphaned pages (`driving-day`, `completed`, `pod`) that nothing in the live app could navigate to — Today's own inline completion sheets already cover that functionality. Before that: a full Admin rebuild (shared shell, Billing, Errors, Support, Platform admins) and a Settings/Team/History+Reports reorganization to remove real duplication (two separate invite forms, branch settings split across two pages, a dead link back to a page that itself redirected to Settings).

## Files Changed (this session — see git log for the rest)
- `app/routes/*.tsx` + `*.module.css`, `app/manager/manager-shell.tsx` + css, `app/routes/routes-dispatch.css` (Dashboard mobile fixes)
- `app/settings/page.tsx` + css, `app/manager/team/page.tsx`, `app/manager/manager-tools.module.css`, `app/manager/invitations/page.tsx` (now a redirect), `app/manager/branches/page.tsx` (redirect)
- `app/manager/history/page.tsx` + css (merged Reports in), `app/reports/page.tsx` (now a redirect)
- `app/manager/truck/*.tsx`, `app/manager/truck/truck.module.css` (new, replaces a plain `truck.css`)
- `app/admin/admin-shell.tsx` (new), `app/admin/billing/`, `app/admin/errors/`, `app/admin/support/`, `app/admin/admins/` (all new), `app/admin/page.tsx`, `app/admin/companies/*.tsx`, `app/admin/approvals/page.tsx` (now a redirect)
- `app/app-error-listener.tsx` (new), `app/error.tsx`, `lib/support.ts` (new)
- `components/driver-v3/DriverV3Shell.tsx`, deleted `app/driver-v3/driving-day/`, `app/driver-v3/completed/`, `app/driver-v3/pod/`
- `supabase/migrations/044` through `048` (see `CHATGPT_HANDOFF.md` for what each does)

## Validation
- `npm run typecheck`: pass
- `npm run lint`: pass (only pre-existing warnings, all `react-hooks/exhaustive-deps` or `no-img-element` on files this session didn't touch the relevant lines of)
- `npm run build`: pass
- Every mobile/layout change was rendered locally (isolated debug page + Playwright, no live Supabase needed) and visually confirmed before shipping — see `CHATGPT_HANDOFF.md` rule #1.

## Current Task
None open. The founder's last ask was a Driver v3 map/navigation review; no concrete bug was found by static reading (the turn-by-turn navigation engine in `app/driver-navigation-map.tsx` is fully built — voice guidance, live GPS tracking, rerouting, wake lock — contrary to older notes suggesting it was future-phase work). Waiting on the founder to report a specific symptom before touching that code, since it depends on live GPS/routing behavior that can't be verified by reading source.

## Next Step
If picking up the map/navigation thread: ask the founder for a specific reproducible symptom first (lost GPS, wrong ETA, voice not playing, "Arrived" button unresponsive, slow to load) rather than refactoring speculatively — it's a live-GPS feature, not something a code read alone can validate.

## Known Problems
- **Migration numbering collision** (not fixed, blocks `supabase db push` until resolved): `015_driving_sessions.sql` / `015_invitation_token_hash_compat.sql` share a numeric prefix, and so do `034_app_error_reports.sql` / `034_native_push_tokens.sql`. Supabase CLI's ledger keys on that prefix alone. Fix by renaming one file in each pair to the next free number — both tables already exist live either way, so this is bookkeeping only, not a schema risk.
- No known Add Route or route-coordinate blocker (that whole class of bug from the previous handoff entry was resolved and is now considered stable — don't reopen without a new concrete report).

## Do Not Touch
Schema, migrations, RLS, Storage, Auth, Push/VAPID, service worker, tenancy, and unrelated uncommitted workspace files — same as before. Driver v3 is no longer blanket off-limits (touched this session with explicit approval) but treat it as sensitive/live-daily-use; the physically unreachable `app/driver/` (V2) tree stays untouched regardless. Don't re-split History/Reports or re-add the old Approvals form — both were deliberate consolidations of duplicated functionality, not oversights.
