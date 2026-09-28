# RouteHub — handoff for ChatGPT / Grok
Updated: 28 Sep 2026 (Claude Sonnet 5). Founder: Fito.

## 28 Sep 2026 session — Claude worked directly on Driver, now handing it back to ChatGPT

Founder had Claude work directly on `app/driver-v3/**` and the root-level
Driver navigation files this session (explicit, in-session direction,
overriding the normal split below for this stretch of work). Handing Driver
back to ChatGPT now — Claude returns to Manager only. Everything below is
committed to `main`; read it before touching the same files so work doesn't
collide with what's here.

**Splash/loading screens:**
- `components/driver-v3/driver-session-gate.tsx`: the auth splash is now a
  full-viewport `position:fixed` overlay (`zIndex:9999`) that covers
  everything until the session actually resolves, instead of an early
  `return` — this is what stopped the splash → intermediate loading states →
  app sequence the founder didn't want; now it's splash → app, one transition.
- `components/driver-v3/DriverV3Shell.tsx`: header changed from
  `position:absolute` to `position:fixed`. This was the actual fix for a
  multi-day "blurry header icons" bug — root cause was iOS applying a
  preemptive blur-guard effect to `position:absolute` elements with an
  opacity transition. Several other things were tried first and didn't work
  (removing the opacity transition alone, forcing icons to `position:fixed`
  with high z-index alone) — only changing the header's own position fixed
  it. If icons ever look blurry again on iOS, check this first before
  chasing blur/filter CSS.
- `app/driver-v3/today.module.css`'s `.loading` (the `TodayLoading` /
  route-loading screen) had its own `radial-gradient` background removed —
  it was rendering with an unexplained greenish tint on-device. **Status:
  unconfirmed.** The founder reported the green tint again after this was
  live, then clarified they were testing the PWA (not the rebuilt native
  APK), and the conversation moved on before they confirmed whether a full
  close+reopen of the PWA (to pick up the new JS bundle) actually cleared
  it. If it's still happening, the gradient removal was not the real fix —
  investigate further before assuming this is closed.
- `android/app/build.gradle` + `MainActivity.java`: added
  `androidx.webkit` and disabled WebView's algorithmic dark-mode
  re-rendering (`WebSettingsCompat.setAlgorithmicDarkeningAllowed(...,
  false)`), as a theory for the same green tint. **This only affects the
  native Capacitor APK, not the PWA, and is completely untested** — the
  founder was testing the PWA when this was written, so it's unverified and
  possibly unnecessary. Capacitor loads the live Vercel URL
  (`capacitor.config.ts` → `server.url`), so a plain web fix ships to the
  APK on push with no rebuild needed either way — only genuine native-code
  changes like this one need an actual APK rebuild to take effect.

**Navigation (`app/driver-navigation-map.tsx`, `app/driver-navigation.module.css`):**
- Removed the `showTraffic` prop from the map (was cluttering it).
- `fitPoints` now stays empty (`[]`) while GPS is still acquiring, instead of
  centering on the destination — the map shows the driver's real position
  once GPS is ready rather than jumping between destination-then-user.
- Guidance card was simplified to show the turn action as the big line
  (`guidingActionLine`) instead of the raw distance — then the founder
  correctly flagged that hiding the street name entirely (`street:null`)
  went too far; a turn instruction with no street name is not enough
  context (compared explicitly to Google/Waze always naming the street).
  **Fixed**: street name (`guidingStreetLine`) is shown again, right under
  the big action line. Current shape: big = action, middle = street name,
  small = distance.
- Removed `backdrop-filter` from `.guidance` and `.bottom` cards (was
  inconsistent with the rest of the app, and blur-guard risk on iOS — see
  above).
- Controls (`.controls`, the re-center button) moved from
  `bottom: 248px` to `bottom: 170px` to sit closer to the arrival card.
- The bottom arrival card's `sheetExpanded` panel (drag the handle up) was
  already there before this session — shows full address, PO/notes,
  upcoming stops, "Abrir Mapas". Not touched functionally, only discussed
  as the base for a possible restyle (see "Not yet implemented" below).

**GPS timing (new):**
- `lib/driver-v3/gps-warmup.ts` (new file) + `app/driver-v3/driver-gps-warmup.tsx`
  (new file, mounted in `app/driver-v3/layout.tsx` next to
  `DriverLiveLocation`): starts a passive, local-only `watchPosition` the
  moment the Driver app opens (any screen), caching the most recent fix in
  memory. Never shares this to the server — `lib/driver-v3/use-driver-live-location.ts`'s
  existing route-sharing watch is untouched and still only runs while a
  started route is actively being navigated, by design (privacy/battery).
  Only starts if geolocation permission is already granted — never triggers
  a permission prompt on its own.
- `app/driver-navigation-map.tsx`'s `deviceLocation` state is now seeded
  from `getWarmGpsFix()` on mount instead of `null` — this is what actually
  removes the 10-20s "searching for GPS" delay the founder saw every time
  they tapped "Comenzar" — navigation now usually opens with a fix already
  in hand instead of starting `watchPosition` cold.
- `lib/location.ts`: `GEO_OK_SESSION` moved from `sessionStorage` to
  `localStorage` (kept the same key name for backward compat with values
  already on installed devices). Root cause fixed: iOS Safari's
  `navigator.permissions.query('geolocation')` unreliably reports `'prompt'`
  even once actually granted, so the app leaned on this flag as a fallback —
  but `sessionStorage` was wiped every time the PWA was fully closed and
  reopened, making the app act like location had never been granted on every
  fresh cold launch (this is also why the GPS warm-up above would not have
  actually started until some other action re-confirmed location that
  session). Now durable across restarts, like a normal website's remembered
  permission.

**Not yet implemented — just discussed/mocked, no code changed:**
A "Today Pro fused with navigation" concept was explored in a design canvas
(bottom-sheet-over-live-map ideas), then narrowed down to something much
smaller and lower-risk after the founder pushed back on inventing new nav
UI: restyle the *existing* `.bottom` card (the one with `sheetExpanded`
above) with 3 specific tweaks — (1) destination name shown bigger/bolder
above the metrics, (2) distance and ETA split into two labelled chips
instead of one combined line, (3) "Salir" and "Abrir Mapas" become small
icon-only buttons flanking the big green "He llegado" button instead of
"Abrir Mapas" being buried only inside the expanded panel. None of this is
in code yet — it's a live discussion the founder may resume with ChatGPT
directly (they were about to generate reference images externally and said
they'd share whichever one they liked). Read the actual current card in
`driver-navigation-map.tsx` (`.stopSummary` / `.primaryRow` / `.expandedPanel`
around line 590-660) before proposing changes here — it already has more
built (the expand/collapse mechanism, PO/notes, upcoming stops) than a fresh
mockup would assume.

**Also found but not fixed (flagged, not acted on — outside this session's
scope):** `app/driver-v3/driver-preferences.module.css`'s `.row:active`
(the Perfil/Settings list row) sets a light background
(`background-color:#f2f6fb`) with no dark-mode override anywhere in that
file — on a `<Link>` row specifically, a stuck/lingering `:active` state
after navigating can show this light residue in dark mode. Also, nothing in
the app resets `-webkit-tap-highlight-color` anywhere (`app/globals.css` or
layout), which is the likely root cause of tap-highlight artifacts more
generally, not just this one row. Founder wants this checked in Manager too
before it's fixed — Claude will look at the Manager side; the Driver-side
`.row:active` fix itself is still open.

**Do not undo Grok work. Do not invent ETA/fake GPS. Add Route was redesigned again 16–17 Sep with founder approval (two-column panel, mobile full-screen takeover — see "17 Sep 2026" section below) — that supersedes the old "it's approved, don't touch it" line; the current shape is in `app/routes/new-route-responsive.tsx` + `.module.css`, not the retired `new-route-panel.tsx`. Driver v3 was touched on 12 Sep with explicit founder approval (see "Driver v3 cleanup" below) — the old blanket "do not touch Driver" is lifted, but treat it as sensitive: Driver is daily-use by real drivers, verify before changing, and never touch `app/driver/` (frozen V2 fallback, physically unreachable — middleware rewrites every `/driver/*` request to `/driver-v3/*`).**

Live: https://routehub-wisu.vercel.app · repo ifitotech/routehub main · app RouteHub-v2/

## 17 Sep 2026 — three-way area split + git sync rules (read this first)

Founder now runs three agents on this repo at once, each in its **own local clone**, all pushing to the same `origin/main`: **Claude → Manager** (`app/manager/**`, `app/routes/**`, `app/contacts/**`, `app/settings/**`, `app/reports/**`), **ChatGPT → Driver** (`app/driver-v3/**`, `components/driver-v3/**`, `app/driver-navigation.module.css`, `app/driver-route-navigation.tsx`, `app/driver-navigation-map.tsx`), **Grok → Settings**. Don't edit outside your area, even to fix something obviously broken there — say what you see and leave it. A shared/global file (`app/globals.css`, `app/final-polish.css`, `app/layout.tsx`, `public/sw.js`) belongs to everyone — flag it to the founder instead of editing it silently.

This split didn't come from nowhere: two separate incidents forced it, and each one has a concrete rule attached.

1. **Before the split**, both agents spent a full day fixing the same Driver header/nav bug without knowing about each other — a CSS-module class rule and a global `!important` override fought each other, so every fix looked like it did nothing, and ~40 commits went by before anyone realized two agents were undoing each other in real time. **Rule:** if a CSS change seems to have no visible effect, check for a competing high-specificity rule (especially `html body:has(...)` selectors in a global stylesheet) before changing your approach.

2. **On 16 Sep**, ChatGPT's clone had a `git pull --rebase` stuck mid-conflict on `app/routes/new-route-ui.module.css` for over a day while Claude kept pushing to the same file — by the time it got resolved, the rebase's own "onto" commit was 753 commits stale, so finishing it the naive way would have replayed a fix against code that no longer existed. Worse: `git rebase --abort` (used to escape that stale rebase) discarded three Driver CSS edits that had been made *while the rebase sat paused* — those survived only because the resolving agent had already printed their full diff earlier in the session and could reconstruct them byte-for-byte (verified by matching git blob hashes). **Rules that would have prevented this:**
   - **Sync before you start work, not just before you push.** `git pull --rebase origin main` at the start of a session, every session. A rebase against a same-day base is a five-line conflict; against a week-old base it's a rewrite.
   - **Push small and often.** The longer a branch goes unsynced, the bigger and more tangled the eventual conflict.
   - **Never run `git rebase --abort` (or any `reset --hard`-equivalent) without `git status` first.** If there are uncommitted changes beyond what the paused rebase itself is tracking, stash them explicitly (`git stash push -m "..." -- <paths>`) before aborting — `--abort` only restores the *original* autostash from before the rebase started, not edits made during the pause.
   - **The area owner resolves conflicts in their own files.** When a rebase conflicts inside `app/routes/**`, Claude resolves it (has the context to know which side is stale); same for Driver files and ChatGPT, Settings files and Grok. Don't guess at someone else's recent redesign from the outside.

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
