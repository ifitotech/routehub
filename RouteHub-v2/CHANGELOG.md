# Changelog

## Manager — dark-premium foundation (stage 1 of the app-wide redesign)

Scope for this stage: build the dark/light token pair for Manager and remove
the single biggest legibility risk (hardcoded dark text colors that would
stay dark-on-dark once the page background goes dark) - not yet a finished
dark Manager. See "Not done yet" below before treating Manager as ready to
flip to dark by default.

### Added
- `app/manager/manager-theme.css` — `html[data-theme='dark'] main[data-manager-section]`
  block, mapping the same `--rh-*` custom property names Manager's screens
  already read to the approved dark-premium palette (radial-gradient page
  background, glass `.card`/`[class*='card']` treatment, blue/success/
  warning/danger tokens). Manager's existing light values are untouched -
  they're now explicitly the light variant, not "the only variant."

### Changed
- Bulk-converted hardcoded text colors to their token equivalents across
  every CSS file under `app/routes`, `app/manager`, `app/contacts`, and
  `app/settings` (21 files) - e.g. `color:#0f1d35` → `color:var(--rh-ink)`,
  `color:#64748b` → `color:var(--rh-ink-soft)`, `color:#1660f0` →
  `color:var(--rh-blue)`, plus the success/warning/danger equivalents.
  Verified no `background-color` declaration was accidentally caught by the
  same substitution (checked directly - it wasn't). `npm run typecheck` and
  `npm run build` both clean after this pass.

### Stage 2 — glass buttons + Manager dark switched on
Scope: CEO/Admin explicitly excluded from this redesign per the user.

- Added the "crystallized" glass button system (gradient + inset highlight
  + outer glow for Primary, translucent glass for Secondary/Tools, soft
  translucent tint for status/Danger) to every shared button definition
  found in Driver and Manager: `app/driver-v3/v3-app.css` (`.primary/
  .secondary/.danger`, used by every completion sheet), `app/driver-v3/
  today.module.css` (`.primary` CTA, `.toolsButton`), `app/routes/
  routes.module.css` (`.primaryButton/.secondaryButton/.publishButton`,
  the Add Route/Dispatch buttons), `app/manager/truck/truck.module.css`,
  `app/settings/settings.module.css`, and `app/manager/manager-tools.module.css`
  (`.saveButton/.cancelButton/.iconButton`, shared by Team and other
  screens). Each has both a dark value (default) and a light value
  (`html[data-theme='light']` override), per the exact recipe given -
  same interaction spec everywhere: 150ms transitions, `scale(.985)` on
  active, the same focus-visible ring, disabled drops shadows instead of
  just dimming.
- **Removed `useManagerLightTheme()`** from `app/manager/manager-shell.tsx` -
  the same kind of forced-light override Driver had, now gone from
  Manager too. Manager genuinely renders dark by default now (the stored
  theme preference already defaults to `'dark'`), not just "has the
  tokens ready."
- Verified the dark tokens are actually legible before flipping the
  switch, not just assumed: built a small static harness (card, muted
  text, three status badges, a primary button) importing the real
  `manager-theme.css` with `data-theme="dark"` set, screenshotted it with
  Playwright, confirmed every text/badge/button reads correctly, then
  deleted the harness and screenshot - this is the same category of bug
  that got Manager's dark mode disabled before, so it was checked instead
  of assumed fixed.
- `npm run typecheck`, `npm run build` clean; `npm test` still shows the
  same 23 pre-existing failures as the baseline (confirmed via `git
  stash` before this stage) - zero new failures introduced.

### Stage 3 — remaining background tokens + first ghost/segmented control
- Swept the 18 Manager/Routes/Contacts/Settings CSS files still holding
  hardcoded pale-blue/pale-green/solid-accent/grey `background`/
  `background-color` values (116 declarations found via a targeted grep)
  and converted them to their `--rh-*` token equivalents, the same pass
  already done for text colors in Stage 1. Re-ran the same grep after:
  only 16 hardcoded background values remain, all dark-navy family
  (`#18263b`, `#17345c`, etc.) and all already correctly scoped inside
  pre-existing `:global(html[data-theme="dark"])` blocks (verified
  directly in `routes.module.css` - `.builderSection`, `.segmented
  button`, `.segmentActive`) - not a light-mode leak, safe as-is.
- Added the "Ghost" low-priority control treatment to the first segmented
  control (Routes builder's origin/priority pickers in
  `app/routes/routes.module.css`): inactive options now read
  `background: rgba(255,255,255,.045); border: 1px solid
  rgba(147,193,255,.14); color: #BBD3F7` in dark (subtle tinted-navy
  equivalent in light) instead of a flat surface color, and the active
  option uses the same Primary gradient/inset-highlight recipe as the
  main CTA buttons, per the "todos los botones, selects, filtros, tabs
  activos... deben verse como parte de un mismo sistema" spec. This is
  the first of the tabs/filters/segmented-control files still pending -
  the rest of that list (routes-board, unassigned-panel,
  dispatch-calendar, and the other Manager surfaces not yet touched by
  the glass-button pass) is unchanged so far.
- `npm run typecheck` and `npm run build` both clean after this pass.

### Stage 4 — glass treatment for tabs/filters/segmented controls across Routes and History
- Extended the "Ghost" inactive / gradient-active recipe (already used on
  Routes builder's origin/priority segmented control) to every remaining
  tab/filter/segmented-style control in Routes and History:
  `app/routes/dispatch-calendar.module.css` (nav arrows, day cards,
  selected/today states, badge ring), `app/routes/unassigned-panel.module.css`
  (panel surface, drop-target highlight, item rows, Assign button/select,
  issue/done subsection icons), `app/routes/routes-board.module.css`
  (mobile sidebar/map/center toggle), and `app/manager/history/history.module.css`
  (period filter pills, History/Reports tabs, KPI breakdown bars, issue
  callout, detail grid tiles) — all via `html[data-theme='dark']` overrides
  added next to each file's existing light rule, none of these files had
  any dark handling before this pass.
- Audited the remaining files from the original 16-file pending list
  (`contacts.module.css`, `manager-shell.module.css`, `compact-map.module.css`,
  `driver-dropdown.module.css`, `live-route.module.css`,
  `route-contrast.module.css`, `route-search.module.css`,
  `routes-dispatch.css`, `routes-rows.module.css`) for hardcoded
  backgrounds needing conversion — all clean already (either fully
  token-based or already correctly scoped inside an existing
  `html[data-theme='dark']` block from earlier work); `route-detail-view.module.css`
  likewise had no hardcoded backgrounds to convert.
- `npm run typecheck` and `npm run build` clean; `npm test` shows the same
  pre-existing `ENOENT` failures only (files removed earlier this session,
  unrelated to this change) — no new failures.

### Stage 5 — closed a token gap, confirmed remaining "ghost" candidates are already covered
- Audited every remaining `background: transparent` control across Manager/
  Routes (`route-search.module.css` clear button + search results,
  `driver-dropdown.module.css` menu items, `app/routes/manage/manage.module.css`
  grip/toast buttons) to see whether they still needed a hand-written
  Ghost-button dark override. They don't: all of them already read from the
  `--rh-*` alias tokens (`--rh-primary`, `--rh-surface`, `--rh-text-secondary`,
  etc.) that `manager-theme.css`'s `html[data-theme='dark']` block already
  redefines, so they pick up correct dark colors automatically through the
  existing cascade - confirmed by reading that block's full token list
  rather than assuming.
- Found one real gap in that process: `--rh-text-muted` (used by
  `route-search.module.css`'s clear button and `unassigned-panel.module.css`'s
  count/empty text) was never defined by `manager-theme.css` at all, in
  either theme, so those two spots were always silently falling back to a
  literal `#64748b` regardless of theme instead of participating in the
  token system. Added `--rh-text-muted: var(--rh-ink-soft)` to both the
  light and dark blocks in `app/manager/manager-theme.css`, alongside the
  other back-compat aliases already defined there.
- `npm run typecheck` and `npm run build` clean after this change.

### Stage 6 — found why Routes was still rendering light, added a real theme switch
- Root cause of "Routes still looks completely light" after all the dark
  work: nothing in the current code forces light anymore, but the OLD
  Driver shell used to call `applyThemePreference('light')` on every
  mount, which writes `routehub_theme` to `localStorage` - not just a
  runtime override. Any browser that ever opened Driver before this
  redesign has that value permanently stuck at `'light'`, and there was
  no UI anywhere to change it back - `app/settings/page.tsx` explicitly
  had no theme control, with a comment saying Manager was intentionally
  light-only (stale, from before dark became the primary theme).
- Added a real Theme control to Settings → Preferences, next to Language,
  using the same segmented-button pattern: Dark / Light / System,
  wired to the existing `useThemePreference()`/`applyThemePreference()`
  plumbing (already built for Driver, just never exposed for Manager).
  This is the fix that actually lets a browser stuck on the old forced
  light value switch to dark - the CSS/token work in Stages 1-5 was
  correct, it just had no way to be seen on an already-poisoned browser.
- `npm run typecheck` and `npm run build` both clean.

### Stage 7 — real bugs found from live screenshots, not just CSS sweep
The user pushed the branch to a real Vercel preview and reviewed it live, which surfaced
issues no amount of reading CSS in isolation would catch:

- **Driver: the "Complete pickup" confirm dialog had no backdrop at all.**
  `app/driver-v3/page.tsx` imported its `confirmBackdrop`/`confirmSheet`/
  `confirmActions` classes from `components/driver-v3/driver-v3.module.css`,
  a file that only `@import`s two split CSS files for their raw styles -
  it never re-exports their class-name maps to JS. Every one of those
  three classNames resolved to `undefined`, so the dialog rendered with no
  fixed position, no backdrop, and no z-index: it just appeared inline and
  visually collided with the card and CTA button behind it (see the user's
  screenshot). Fixed by importing from `driver-v3-b.module.css` directly,
  where those classes are actually defined - the same pattern every other
  component in this folder already uses.
- **Driver: the Tools (⋮) header button rendered as a flat grey square
  instead of a glass circle.** Two separate causes: (1) its
  `border-radius:50%` in `today.module.css` wasn't `!important`, so it lost
  to the header's own reset rule (`header button{border-radius:0!important}`
  in `v3-app.css`) on that one property, even though the rest of the rule's
  `!important`s did win on specificity; (2) it had no light-mode variant,
  so in light mode the dark-navy glass recipe composited over the white
  header as a dull grey-blue box instead of adapting. Added `!important` to
  `border-radius` and a proper `html[data-theme='light']` override using
  the same pale-glass recipe as the other secondary buttons.
- **Contacts empty state and Add Route builder were still visibly
  light-only in dark mode**, confirmed from the user's own screenshots:
  `.empty`/`.dialog` in `app/contacts/contacts.module.css` used literal
  `rgb(255 255 255 / X%)` instead of a token; the desktop top bar
  (`.sidebar` in `app/manager/manager-shell.module.css`, ≥1201px) had no
  dark override at all; `app/routes/routes.module.css`'s `.operationSummary`/
  `.summaryCard`/`.mapShortcut`/`.dateTabs` (the Routes dashboard's KPI
  row) had none either; `app/routes/new-route-ui.module.css` (the inline/
  mobile Add Route panel's type cards, timeline, origin toggle, driver
  card, schedule toggle) had **no dark handling anywhere in the file**;
  and `app/routes/add-route-desktop.css` - a separate `!important`-only
  override file for the desktop Add Route drawer - forced white
  backgrounds regardless of theme, silently beating the dark rules in
  `routes.module.css` since importance ties go to specificity/source order
  and this file had no `!important` dark counterpart at all. Added a
  matching `html[data-theme='dark']` block to each.
- `npm run typecheck`, `npm run build` clean; `npm test` shows only the
  same pre-existing `ENOENT` failures as the baseline.

### Stage 8 — full Driver + Manager coverage sweep
Ranked every CSS/module file under Driver and Manager by how little dark-mode handling it
had (grep count of the word "dark"), to find files that had slipped through earlier passes
entirely rather than re-checking files already known to be fine.

- Found and fixed the one real remaining gap: `app/routes/route-detail-view.module.css`
  (the route detail/evidence panel) had zero dark handling - `.evidenceButton:hover`,
  `.evidenceImage` border, and `.issueSection` (the issue callout) were all hardcoded
  light-only. Added the matching dark block.
- Everything else on the "zero dark mentions" list turned out to already be safe on
  inspection, for one of two legitimate reasons: (1) layout-only files with no color/
  background declarations at all (`compact-map.module.css`, `add-route-cards.css`,
  `daily-progress.module.css`, `dispatch-layout.module.css`, `live/live.module.css`,
  `manage-mobile-fixes.module.css`, `routes-dispatch.css`), or (2) files that read
  exclusively from the `--rh-*`/`--primary`/`--surface`/`--ink` token names that
  `manager-theme.css` and `globals.css` already redefine for dark (`driver-dropdown`,
  `route-search`, `routes-rows` in `app/routes`) - confirmed by reading each file rather
  than trusting the ranking alone.
- Checked every Driver sub-route directory (`help`, `history`, `issue`, `map`, `more`,
  `privacy`, `route`, `settings`, `stop`, `truck`, `truck/fuel`, `truck/maintenance`) for
  its own CSS files - none exist; they all share the already-audited `today.module.css`/
  `v3-app.css`/`driver-v3-a`/`driver-v3-b` classes.
- `npm run typecheck`, `npm run build`, `npm test` all clean (same pre-existing `ENOENT`
  baseline failures only).

### Stage 9 — confirmed the confirm-dialog fix, added a regression test
The user still saw the broken confirm dialog (no backdrop) on a fresh screenshot after
Stage 7's fix was pushed. Re-verified from the actual compiled build output rather than
re-reading source: ran `npm run build` and grepped `.next/static/css/*.css` for the real,
hashed `.confirmBackdrop` rule - it correctly compiles to
`position:fixed;inset:0;z-index:210;background:rgba(15,29,53,.52)...`, i.e. the Stage 7
fix is genuinely correct and present in the build. Also confirmed via the GitHub
deployments API that the latest Vercel deployment (state: success) matches this exact
commit. So the screenshot was very likely a stale PWA/browser cache showing the
pre-fix bundle, not a remaining code bug - the fix is real; ask the user to hard-refresh
or open the preview URL in a private window to rule out the service worker cache.

- Added `tests/driver-confirm-dialog.test.mjs`: asserts `page.tsx` imports
  `confirmStyles` from `driver-v3-b.module.css` (not the combined
  `driver-v3.module.css`, which only `@import`s its split files and
  re-exports no classNames), that all three dialog classNames it uses are
  actually defined there, and that `.confirmBackdrop` is `position:fixed`
  with a real `z-index` - so a future edit that reintroduces this exact
  bug fails a test instead of only being caught by eyeballing a
  screenshot.
- `npm test` (including the new test) passes; only the same pre-existing
  `ENOENT` baseline failures remain, unrelated to this change.

### Not done yet (real, not hidden)
- **Manager still renders light-only.** `useManagerLightTheme()` in
  `app/manager/manager-shell.tsx` still forces the document to light on
  every Manager mount - the same mechanism Driver had, removed there but
  deliberately left in place here until the rest of this list is done.
  Removing it now, before the next item, would reproduce the exact
  dark-on-dark bug that got Manager's dark mode disabled before.
- **~19 files still hardcode a near-white card background** (`#fff`,
  `#f8fafc`, etc.) that would show as a glaring white box on the new dark
  page background. This needs a careful pass, not a blanket find/replace -
  some of those whites are correct in any theme (text on a solid blue
  button, for instance) and a mechanical substitution would break those.
- Border colors (`#dbe3ed`, `#e5e7eb`, etc.) and the long tail of one-off
  badge/status colors are also unconverted.
- Admin/CEO, Login/Onboarding, and the rest of the app-wide redesign
  (per the user's own stated order of work) have not been started.


## RouteHub Driver — dark-premium redesign (Today + Tools)

Visual-only redesign of the Driver "Today" screen (before-start and active-route
states) plus a new Tools menu, per the approved dark-premium concept. No
operational logic, Supabase/Auth/RLS/GPS handling, route queue behavior,
evidence capture, Pickup/Delivery/Return flows, notifications, or external
Maps deep links were changed - every mutation still goes through the exact
same functions as before (`startRoute`, `markArrived`, `completePickupWithEvidence`,
`completeReturn`, `completeDelivery`/`completeDeliveryWithRecipient`,
`reportIssue`, `saveStopNote`, `saveStopSignature`, `uploadStopPhoto`,
`openNavigationWithFallback`).

### Added
- `app/driver-v3/driver-theme-tokens.css` — the exact dark/light token system
  (colors, gradients, glass-surface values) scoped to `.driver-v3-root`. Dark
  is the default; `html[data-theme='light']` swaps the tokens only, never the
  structure.
- `app/driver-v3/route-glyph.tsx` — the abstract A → B route visual (curved
  line, blue origin, teal destination, glow halos). Illustrative only - no
  tiles, streets, geographic names, or embedded map/navigation of any kind.
  Tapping it is not wired to anything; opening real navigation still only
  happens through the existing "Open Maps" action.
- `app/driver-v3/today-tools-sheet.tsx` — the new Tools bottom sheet: Open
  Maps, Call (only rendered when the stop actually has a phone number), and
  Report an issue. Each calls the exact same handler Today already used for
  that action.
- `CHANGELOG.md` (this file).

### Changed
- `components/driver-v3/DriverV3Shell.tsx` — removed the `applyThemePreference('light')`
  call that unconditionally forced every Driver screen to light on every
  mount, regardless of the stored preference. This is the root cause of dark
  mode "not working right" before: Driver could never actually resolve to
  dark, no matter what was stored or what the system preference was. Added an
  optional `rightSlot` prop so a screen can swap the header's default Profile
  shortcut for its own action (Today now uses it for the Tools button); every
  other screen is unaffected and keeps the Profile shortcut.
- `app/driver-v3/layout.tsx` — imports the new token stylesheet.
- `app/driver-v3/page.tsx` — Today's hero restructured to: type pill, "Stop X
  of Y" with a compact dot indicator, client name (max two lines), address,
  PO shown only for Pickup, the existing `DriverRouteEstimate` (distance +
  time), the new route glyph, and a single Start/Complete button. Maps, Call,
  and Report an issue moved out of the hero into the new Tools sheet (opened
  from the header's three-dot button), matching "never next to the main
  button." Handlers themselves (`startCurrent`, `arrivePickup`, `confirmPickup`,
  `completeReturnNow`, `openDelivery`, `openReturn`, `confirmDelivery`,
  `savePickupNote`, `requestPhoto`, `sign`, `primary()`, the pull-to-refresh
  and swipe-to-next-route gestures) are untouched - only how their triggers
  are laid out changed. The Info/Pickup/Return/Delivery/Next-stop completion
  sheets (`today-sheets.tsx`) are unmodified.
- `app/driver-v3/today.module.css` — hero, pill, CTA, feedback banner, empty/
  error state card, next-stop chip, and swipe-to-next-route zone now read
  from the token system instead of hardcoded light colors; the old, separate
  `html[data-theme='dark']` overrides for these same elements were removed
  where they would otherwise have won on source order and silently undone
  the new palette in dark mode. Responsive rules at the existing breakpoints
  (max-width 374px, the compact-Android max-width/max-height pair, and
  max-height 760px) updated to size the new elements instead of the ones
  they replaced.
- `components/driver-v3/DriverRouteEstimate.module.css` — restyled to the new
  typography/token scale (distance/time now 22-26px/780 weight, labels
  9FB2D0-family) without touching the component's own logic.
- `components/driver-v3/driver-v3-a.module.css` — bottom nav restyled per
  spec (translucent navy/blur background, muted/active token colors, a
  3px cyan-to-blue gradient indicator under the active tab). Applies to
  every Driver tab (Today, Routes, Truck, More), matching "improve the
  visual only, keep the same tabs and routes."

### Refinement pass (matching the reference images more closely)
- `app/driver-v3/route-glyph.tsx` — added the origin/destination text labels
  the reference shows ("PICKUP START" under the blue dot, the stop's own
  name under the teal pin), which the first pass was missing entirely.
- `app/driver-v3/today.module.css` — enlarged `.routeGlyphHost` (104px →
  150px, scaled proportionally at every breakpoint) to match the visual
  weight the route illustration has in the reference.
- `components/driver-v3/DriverRouteEstimate.module.css` — removed the
  metrics row's own card border/background; distance and time now sit
  directly on the hero's glass surface (icon chips only), matching the
  reference instead of reading as a second nested box.

### Header now follows the theme too
- `components/driver-v3/driver-v3-b.module.css`, `app/driver-v3/v3-app.css` —
  the header bar (logo, back/map icon, the new Tools button) was forced navy
  in both themes; added `html[data-theme='light']` overrides at the same
  `!important` weight as the existing dark-forcing rules so light mode gets
  a white header with a navy wordmark, matching the light reference, instead
  of a dark bar sitting over a light page. This is shared chrome (every
  Driver screen uses the same header), so it also lightens History, Truck,
  Settings, and More in light mode - re-verified `npm run build` after this
  change specifically because of that wider reach.

### Verified unchanged
- Every Supabase/Auth/RLS-touching call site, GPS/driving-session handling,
  the route queue, evidence capture (photo/signature/notes), and the
  Pickup/Delivery/Return completion flows - confirmed by re-reading
  `page.tsx`'s handlers after the edit and by `npm run typecheck` /
  `npm run build` passing clean.
- No screen or route was deleted or renamed.
