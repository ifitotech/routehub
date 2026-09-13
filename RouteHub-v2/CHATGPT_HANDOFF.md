# RouteHub — handoff for ChatGPT / Grok
Updated: 12 Sep 2026 (Claude Sonnet 5). Founder: Fito.

**Do not undo Grok work. Do not invent ETA/fake GPS. Do not redesign Add Route again — it's approved (see 12 Sep section for what changed since). Driver v3 was touched on 12 Sep with explicit founder approval (see "Driver v3 cleanup" below) — the old blanket "do not touch Driver" is lifted, but treat it as sensitive: Driver is daily-use by real drivers, verify before changing, and never touch `app/driver/` (frozen V2 fallback, physically unreachable — middleware rewrites every `/driver/*` request to `/driver-v3/*`).**

Live: https://routehub-wisu.vercel.app · repo ifitotech/routehub main · app RouteHub-v2/

⚠️ There is an OLD/unrelated deployment at `routehub-seven.vercel.app` — it is a stale first base, not connected to current work. Never use it as a reference or deploy target.

## 12 Sep 2026 session (Claude, authorized, DONE) — read this first, it supersedes older sections below where they conflict

A full pass over Dashboard mobile bugs, then Settings, then Admin, then Driver v3 — each confirmed working (locally rendered, typecheck/lint/build clean) before shipping. Two house rules this session established that should hold for future work here, regardless of which model is doing it:

1. **Verify a UI change actually renders before calling it done.** Several "obvious" CSS fixes this session turned out wrong on the first guess (a genuine root cause was a `flex: 1 1 340px` written for a desktop row layout being reinterpreted as a *height* once the mobile breakpoint switched that same container to `flex-direction: column` — completely invisible from reading the JSX, only found by rendering the real component tree and reading `getBoundingClientRect()`). When a mobile/layout bug resists an obvious fix, render it (a local `npm run dev` + Playwright against an isolated debug page works without needing live Supabase — see any recent commit message for the pattern) rather than iterating blind on CSS guesses.
2. **When something is unreachable, delete it — don't leave it "just in case."** Found and removed several dead pages this session (`/manager/branches`, `/manager/invitations`, `/admin/approvals` all redirect to where their functionality actually lives now; `/driver-v3/driving-day`, `/driver-v3/completed`, `/driver-v3/pod` were deleted outright because *nothing* linked to them and Today's inline sheets already cover the same flow). Before deleting, grep the whole repo for every plausible way the route could be reached (string literal, template literal, dynamic construction) — don't trust one grep pattern.

**Dashboard (`/routes`) mobile fixes:**
- Header no longer inflates on phones (the `flex-basis`-as-height bug above). Action buttons (driver filter / Contacts / Manage / Add) are a single horizontally-scrollable row instead of wrapping.
- `ManagerShell`'s mobile `.content` now pads for `env(safe-area-inset-top)` — the eyebrow/title no longer renders under the phone's status bar.
- `routes-dispatch.css`'s `[data-routes-dispatch]` block had a flat `padding: 0 0 20px !important` that crushed the space reserved for the fixed bottom nav on mobile; now `calc(100px + env(safe-area-inset-bottom))` below the 1023px breakpoint.
- Calendar strip shows 5 days instead of 7 on phones (was unreadably cramped).
- Search now shows a real dropdown of matches across all history (destination, date, driver, status) instead of silently filtering whatever day was already on screen.
- Bottom mobile nav and the desktop top nav are both genuinely centered now (previously the desktop one just sat flush against the logo; the mobile one stretched edge-to-edge).
- Nav swap: **Truck replaced History** in the primary nav/bottom bar. History is still reachable — merged into Reports (see below).

**Settings rebuild:** grouped Account (profile/language/notifications/app) vs Branch (name/address/phone + primary driver + auto-close time, now all in one place instead of split between Settings and Team) vs Reports & History vs Plan/Billing vs Support. Removed a dead link to `/manager/branches` (which itself just redirected back to Settings) and a duplicate Truck row.

**Team page:** member card grid had a real bug — the template only defined 4 columns but 5 items rendered in the non-editing state, so the delete button silently wrapped onto an invisible 5th row. Fixed by grouping edit+delete into one grid cell. Invitations (send + pending/revoked list) now live inline in Team instead of a separate page with its own duplicate invite form.

**History + Reports merged** into one page at `/manager/history` with an Overview/Route-log tab switcher, one shared header and period/driver filter instead of two pages running nearly the same query. `/reports` redirects to `/manager/history?tab=overview`.

**Truck page** converted from a plain global `truck.css` (imported once via `app/globals.css`, meaning any other file could accidentally define a colliding `.truckHero` etc.) to a proper CSS Module.

**Admin rebuilt into an actual platform control panel** (was a handful of independently-`<main className="app">` pages with a bottom nav that only existed on the home page). New shared `AdminShell` (`app/admin/admin-shell.tsx`) — every `/admin/*` page should use it. Sections now: Home, Companies, **Billing** (new — per-company plan/subscription/trial, was previously only editable straight in the Supabase dashboard), **Errors** (new — `app_error_reports` already existed but nothing read or wrote to it outside one narrow case; there's now a global `window.onerror`/`unhandledrejection` listener (`app/app-error-listener.tsx`, mounted in root `layout.tsx`) plus a wired `app/error.tsx` render-crash boundary, both reporting through `lib/error-reporting.ts`'s existing `reportAppError()`), **Support** (new — Settings' "Contact support" button used to just show a fake success message and send nothing anywhere; now inserts into a new `support_requests` table), **Platform admins** (new — granting/revoking CEO-level access had zero UI before this). `/admin/approvals` (its one working form's insert never set `company_id`, so it silently granted nobody anything) redirects to `/admin/billing`.

**Driver v3 cleanup** (explicit founder approval to touch it this session): fixed the bottom nav lighting up both "Today" and "History" simultaneously on certain sub-screens, then discovered those sub-screens (`completed`, `pod`) plus `driving-day` were all orphaned — unreachable from any live navigation path, superseded by logic that now lives inline in Today/Settings — and deleted them. Do not resurrect them without checking Today's `sheet` state machine first; the functionality already exists there.

**New migrations this session:** 043 (superseded, deleted — see 044), 044 (`app_error_reports` admin RLS policy), 045 (renamed from a colliding `015_invitation_token_hash_compat.sql` — see "Known repo issue" below), 046 (`platform_update_company_billing` RPC), 047 (`support_requests` table), 048 (`platform_admins` completed defensively + RLS — the table already existed live, untracked by any migration).

⚠️ **Known repo issue, not fully fixed:** two pairs of migrations share a numeric prefix (`015_driving_sessions.sql` / `015_invitation_token_hash_compat.sql`, and `034_app_error_reports.sql` / `034_native_push_tokens.sql`). Supabase CLI's migration ledger keys on that numeric prefix alone, so `supabase db push` will fail on `034_native_push_tokens.sql` with a duplicate-key error until one of that pair is renamed to a free number. Both tables it creates already exist live (confirmed via `create table if not exists` no-oping), so it's a bookkeeping problem, not a schema one — the workaround this session was temporarily moving that one file out of `supabase/migrations/` before `db push --include-all`, then moving it back. Fix properly (rename it to the next free number) before it blocks someone else's push.

## Preference changes already on main (do not reopen)
- Routes + OperationsMap fused on `/routes`. Map tab gone. `/routes/live` → `/routes`.
- Manage is a same-page toggle (`/routes?manage=1`). `/routes/manage` redirects there.
- In Manage only: Subir / Bajar / Cancelar via `reorder_route_queue`. Active/completed not movable.
- Tomorrow stays in the list, not drawn on the map (`3395c23f`).
- Add Route visual is approved. PO = `order_number`, Pickup only.
- Driver `/driver` → driver-v3. Do not edit it.

## Manager IA 10 Sep (authorized)
- Desktop sidebar: Hoy · Rutas · Contactos · Más.
- Mobile: Hoy · Rutas · + · Más.
- `/manager/more` grouped: Operación (Camión, Historial, Reportes) · Empresa (Equipo, Invitaciones, Sucursales, Contactos) · Cuenta (Settings).
- Hoy is a summary (counts + GPS line + status + short list + issues). No second map. Links to `/routes`.
- `/operations` → `/routes`.
- History = past stops. Reports = counts. Both under Más.

## Manager sell-ready redesign — 10–11 Sep 2026 (Claude, authorized, DONE)
Full visual audit + redesign of Manager for client-facing sale readiness. Navy `#0B1F3A` + electric blue `#1660F0` + white, light-mode only (dark mode disabled while Manager is mounted). Driver untouched throughout. No Supabase/schema changes.

**Phases 0–7 (commit `cf947fd`):**
- `manager-theme.css` — single token source for Manager, scoped to `main[data-manager-section]`.
- Nav expanded to 5 destinations (added History). Mobile nav rebuilt from array.
- `CompactMap` shared component (Today, Routes, Add Route) — collapsed by default, expands on tap, fullscreen overlay on mobile.
- Settings absorbs old `/manager/more` links; `/manager/more` is now a redirect.
- Today: always-visible attention banner (alert/ok tones), map wrapped in CompactMap.
- Routes: color unification (`#1660f0` primary, `#0e48c4` hover), simplified map/modal logic via CompactMap.
- Add Route (`new-route-dialog.tsx`): typed props, CompactMap preview, localized copy.
- Contacts: kebab menu (Map/Call/Edit/Delete) replacing 6 inline buttons.
- Team: inline invite panel, inline role change, primary driver + auto-close time settings.
- History/Reports: i18n `operations` eyebrow, color unification.

**Post-redesign fixes (commits `c6e2a34`, `cefe9d0`, `6940268`):**
- Fixed mobile menu z-index clash in Contacts (kebab menu was overlapping adjacent cards) — menu now `position: fixed` on mobile, z-index 41.
- Added pull-to-refresh to Manager Today: touch gesture detection (scrollY=0 + swipe down), threshold 60px, refreshes routes + summary via existing `loadManagerDashboard`.
- Polished pull-to-refresh animation: cubic-bezier easing, glassmorphic blur backdrop, dynamic copy states (Pull down → Release → Refreshing), i18n EN/ES/FR.

**Standing instruction from founder:** RouteHub Manager is being built as a premium product — every detail matters (animation easing, hover/focus states, transitions, spacing), not just functional correctness. Compare interactions against apps like Gmail/Instagram/Stripe/Linear.

**Next up:** Fase 9 Part 2 — warmth pass (dynamic greeting by hour 7am–5pm, friendlier copy, softer colors) + Android push notification audit (Capacitor FCM permissions).

## Files touched in Manager redesign
- `app/manager/manager-shell.tsx`, `manager-shell.module.css`, `manager-theme.css` (new)
- `app/manager/compact-map.tsx` (new), `compact-map.module.css` (new)
- `app/manager/page.tsx`, `manager-dashboard.module.css`, `manager-today.module.css`
- `app/manager/team/page.tsx`, `manager-tools.module.css`
- `app/manager/invitations/page.tsx`, `manager/history/page.tsx` + css
- `app/manager/more/page.tsx` (now a redirect), deleted `more.module.css`
- `app/settings/page.tsx`, `settings.module.css`
- `app/contacts/page.tsx`, `contacts.module.css`
- `app/routes/*.tsx` + `*.module.css` (color unification, CompactMap integration)
- `app/reports/page.tsx`, `reports.module.css`
- `app/app-bottom-nav.tsx` (Manager surface detection)
- `docs/MANAGER_REDESIGN_AUDIT.md` (new — full audit doc)
