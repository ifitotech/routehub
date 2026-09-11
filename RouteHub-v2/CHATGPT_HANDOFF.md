# RouteHub — handoff for ChatGPT / Grok
Updated: 11 Sep 2026. Founder: Fito.

**Do not undo Grok work. Do not invent ETA/fake GPS. Do not touch Driver. Do not redesign Add Route.**

Live: https://routehub-wisu.vercel.app · repo ifitotech/routehub main · app RouteHub-v2/

⚠️ There is an OLD/unrelated deployment at `routehub-seven.vercel.app` — it is a stale first base, not connected to current work. Never use it as a reference or deploy target.

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
