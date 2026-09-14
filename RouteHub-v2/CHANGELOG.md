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

### Stage 10 — the two remaining out-of-place elements the user flagged
Two Today-screen elements were still visually left over from before the redesign,
correctly called out as "no le pega a este estilo":

- **"Swipe up for the next route" / "No more pending routes"** (`.routeSwipeZone`)
  used to be bare text sitting directly on the page background with no
  container at all - it read as disconnected from the glass hero card and
  CTA above it. Gave it the same glass-pill treatment as `.nextChip` right
  above it (border/background from the `--rh-border`/`--rh-surface-soft`
  tokens, backdrop-blur), so the two stack as one visual family instead of
  a styled card followed by plain floating text.
- **Pull-to-refresh's truck-on-a-road animation** (`.pullRoad`/`.pullRoadLine`/
  `.pullTruck`) was still hardcoded to its original light-only colors
  (`#dde5ee` road, white truck icon) with no dark handling at all, so
  pulling down on Today showed a jarring light-grey road and white icon
  against the new dark page background. Rewrote the base (unscoped) rules
  to dark-appropriate values and added an `html[data-theme='light']`
  override with the original light colors, matching the driver token
  convention. The "ready to refresh" and "refreshing" states
  (`.pullReady .pullTruck`/`.pullTruckDriving`, already a blue gradient)
  were left as-is - that accent already reads correctly on both themes.
- `npm run typecheck`, `npm run build` clean.

### Stage 11 — the same broken-import bug existed in 3 more places, plus 2 real Driver Settings bugs
Re-checked every Driver file for the exact "imports from the combined driver-v3.module.css"
pattern instead of assuming Stage 7's single fix covered it - it didn't:

- `app/driver-v3/settings/page.tsx` had the **same** broken `confirmStyles` import as the
  Today confirm dialog (used twice - both its own confirm dialogs, e.g. Sign out). Fixed
  to import from `driver-v3-b.module.css`.
- `app/driver-v3/truck/fuel/page.tsx` and `app/driver-v3/truck/maintenance/page.tsx` both
  imported `shellStyles` from the same broken combined file for `.stickyAction` (the
  floating Save bar) - it silently lost its fixed positioning and gradient background.
  Fixed both to import from `driver-v3-a.module.css`, where `.stickyAction` is defined.
- Generalized `tests/driver-confirm-dialog.test.mjs` into a real regression test: it now
  scans every file under `app/driver-v3` and `components/driver-v3` for this exact broken
  import pattern, instead of only checking the one file already known to have had it - this
  is what should have caught the 3 additional instances immediately instead of them being
  found one screenshot at a time.
- **Real bug, unrelated to the import issue:** the "Check for updates" row in Driver
  Settings is a raw `<button>` (every other row is a `<Link>`), and iOS Safari keeps its
  native rounded/shadowed button chrome unless `appearance:none`/`-webkit-appearance:none`
  is set explicitly - `background:transparent` alone doesn't remove it. That's why it
  rendered as a solid white rounded box sitting starkly on top of an otherwise-dark screen
  in the user's screenshot. Added the missing `appearance` reset to `button.row` in
  `driver-preferences.module.css`.
- **Real gap, not a bug:** Driver had no way to switch theme at all (Manager got one in
  Stage 6, Driver never did) - added the same Dark/Light/System control to Driver Settings,
  right below Language, reusing the already-dark-aware `.languageChoice` styling.
- `npm run typecheck`, `npm run build`, `npm test` all clean (new tests included, same
  pre-existing `ENOENT` baseline failures only).

### Stage 12 — real background map on Today, per the user's own reference image
The user approved a reference showing the route line drawn over a real, dark street map
instead of empty space, and confirmed this reverses the project's original "no embedded
maps" rule (updated in the pinned memory) - it stays strictly a non-interactive **view**;
"Open Maps" is still the only way to actually navigate.

- Found `components/driver-v3/DriverRoutePreview.tsx` already existed - a non-interactive
  Leaflet map (dragging/zoom/click all disabled) built earlier for exactly this purpose,
  wired to nothing because the old rule was in effect. Revived it instead of building a
  second map component from scratch.
- Swapped its tiles from plain OpenStreetMap to **CARTO Dark Matter** (free, no API key,
  no Google - the user picked this specifically over a paid Mapbox custom style) with a
  light-mode fallback to the original OSM tiles, matched to the app's own theme via
  `useThemePreference()`.
- Restyled the whole component to the dark-premium palette: the origin marker is a plain
  glowing blue dot, the destination is a teal/cyan pin with the stop's real name in a
  glass label chip underneath (matching the reference image), the route line uses the same
  blue as the rest of the app, and a radial vignette keeps the map from competing with the
  hero card's text regardless of what the tiles underneath happen to show.
- Wired it into `app/driver-v3/page.tsx`'s hero in place of the abstract `RouteGlyph` line
  illustration (now unused - left in place, not deleted, in case a future no-coordinates
  fallback needs it back).
- **Fixed a real build break this introduced**: Leaflet touches `window` at import time,
  which crashes Next.js's static prerendering when imported directly into a page module.
  Loaded it via `next/dynamic` with `ssr:false`, the same pattern every other Leaflet
  consumer in this app already uses (`driver-route-navigation`, `compact-map`, etc.) -
  `npm run build` failed before this fix and is clean after it.
- `npm run typecheck`, `npm run build`, `npm test` all clean (same pre-existing `ENOENT`
  baseline only).

### Stage 13 — the app-wide generic classes still made Truck/History feel like an older app
Audited every Driver sub-route (`help`, `history`, `issue`, `map`, `more`, `privacy`,
`route`, `settings`, `stop`, `truck`, `truck/fuel`, `truck/maintenance`) for what it's
actually styled by, not just whether it imports a `.module.css`:

- `truck/page.tsx` and `history/page.tsx` use the app-wide generic `.card`/`.row`/
  `.eyebrow`/`.muted` classes from `app/globals.css` (shared with Manager/Admin), not a
  Driver-specific module. These already resolved correct dark/light **colors** through
  globals.css's own theme tokens - not a legibility bug - but rendered as flat, plainly
  bordered boxes sitting right next to Today's glass hero card, reading as an older,
  plainer screen in the same app.
- Added a `.driver-v3-root`-scoped override for exactly these four classes in
  `app/driver-v3/v3-app.css` (same file and pattern already used for the Primary/
  Secondary/Danger button glass recipe): translucent gradient card with backdrop-blur and
  a soft inset highlight in dark, a lighter glass equivalent in light - both classes beat
  globals.css's single-class selector on specificity, so no `!important` was needed.
  `issue`, `route`, and `stop` are thin redirect pages with no real UI of their own; `map`
  already reads from its own properly dark-aware classes in `driver-v3-b.module.css`.
- `npm run typecheck`, `npm run build`, `npm test` all clean (same pre-existing `ENOENT`
  baseline only).

### Stage 14 — the map reads as fused into the card, not pasted on top of it
The user pointed at the abstract-glyph reference again and asked for the same "no frame,
merged into the card" feel now that the map is a real one - the glyph never had a visible
box because it was just SVG lines drawn straight on the hero's own background; a real map
has an actual rectangle of tiles, so getting the same feel needed a deliberate fade instead
of just removing a border.

- Removed `.routeGlyphHost`'s border and border-radius clipping in `today.module.css`.
- Added a radial `mask-image`/`-webkit-mask-image` to `DriverRoutePreview.module.css`'s
  `.preview` (opaque through the middle, fading to fully transparent at every edge) so the
  map's own rectangle dissolves into the hero card's glass background instead of ending in
  a hard-edged box - this masks the whole element as one unit (tiles, route line, markers),
  since `.preview` is already its own stacking context (`isolation: isolate`).
- Removed the small "A → B" caption chip entirely - it sat in the corner the mask fades
  hardest first (so it would have looked washed out), it wasn't in the reference image,
  and it duplicated information already shown in the address line above it. Kept the
  operational status text (loading/approximate/map-unavailable) since a driver actually
  needs that - recentered it at the bottom instead of bottom-left so it clears the mask.
- `npm run typecheck`, `npm run build`, `npm test` all clean (same pre-existing `ENOENT`
  baseline only).

### Stage 15 — dropped CARTO for keyless OSM+filter; fixed 8 of 10 pre-existing test failures
- **CARTO Dark Matter tiles from Stage 12 require an API key now** (their anonymous free
  tier was discontinued) - the live preview showed "API KEY REQUIRED" watermarked across
  the map. Switched both themes to plain OpenStreetMap (already used for light) and fake
  the dark look with a CSS filter on the tiles (`invert(1) hue-rotate(190deg) brightness(.86)
  contrast(.92) saturate(1.35)`) instead of a second, keyed tile source - still a real
  street layout, no account needed, no cost.
- Fixed 8 of the 10 pre-existing test failures (confirmed unrelated to this redesign,
  present before this work started) by updating each to the file that now actually holds
  what it was checking, since the referenced files were renamed/split/removed by earlier,
  unrelated work: `app/driver/page.tsx` → `middleware.ts` (the /driver→/driver-v3 rewrite
  moved there); `app/driver-v3/driving-day/page.tsx` → `app/driver-v3/settings/page.tsx`
  (driving-day start/end is now an inline Settings toggle, not its own screen);
  `app/routes/new-route-dialog.tsx`/`new-route-fields.tsx` → `new-route-panel.tsx`/
  `new-route-details.tsx` (same builder, split into two files); one assertion
  (`kind!=='return'`) was actually stale from before this session's own Today redesign,
  which intentionally narrowed PO display to pickup-only stops - updated to match.
- **The other 2 failures are a real, pre-existing regression, not a test-path issue**:
  `app/driver-v3/completed/page.tsx` - a dedicated "Finish route" confirmation screen that
  called `finalizeRoute()` - was removed with no replacement. `finalizeRoute()` and
  `canFinalizeRoute()` are still exported from `lib/driver/driver-actions.ts` /
  `lib/stop-workflow.ts` but **nothing in the app calls them anymore** (confirmed via a
  repo-wide search). The database's own finalization trigger
  (`enforce_route_queue_finalization` in migration 026) only *validates* an update to
  `finalized_at` - it doesn't set it on its own. Net effect: **routes may never actually
  reach `finalized_at` today**, even after every stop completes. Left these 2 tests
  failing rather than editing them to pass, since silencing them would hide a real gap
  instead of documenting it - flagged to the user for a product decision rather than
  guessing at a fix.
- Also found, while chasing one of these old paths, that `TemporaryRouteAssignments`
  (shown to Sales/Counter roles today) is no longer rendered on the Manager or Operations
  dashboards (`app/manager/page.tsx` and `app/operations/page.tsx` are now redirect stubs
  to `/routes`, which doesn't render it) - same category of pre-existing gap, flagged
  alongside the finalization one rather than fixed blind.
- `npm run typecheck`, `npm run build` clean; `npm test` now shows 2 failures (both the
  real finalization gap above), down from the original 10.

### Stage 16 — fixed both real regressions the test cleanup surfaced; 149/149 tests pass
The user confirmed both fixes: routes should auto-finalize (no confirmation screen), and
Manager/Operations should get their temporary-route-assignments widget back.

- **Routes now finalize automatically.** Added `autoFinalizeRouteQueue()` to
  `lib/data.ts`, called from every success path of `completeMission()` (the single
  completion choke point used by pickup/delivery/return alike). After a stop completes, it
  checks whether the driver's whole day queue is now finalizable
  (`canFinalizeRoute()`, the same guard the old confirmation screen used) and, if so,
  immediately sets `finalized_at`/`route_completed_at`/`finalization_method:'normal'` on
  the just-completed stop - no separate screen, no driver action required. Wrapped in
  try/catch and never blocks or fails the stop completion itself, which has already
  succeeded by the time this runs.
- **`TemporaryRouteAssignments` restored for Manager/Operations.** Added it to
  `routes-screen.tsx` (the shared dashboard both roles land on now that Today/Routes
  merged) right below the header - same self-contained, renders-nothing-when-empty
  component Sales and Counter already use, so a branch/operations manager covering a
  route sees it without leaving their normal workspace.
- **Restored the "Replay tour" control** discovered missing from both Settings screens
  while fixing this - `requestOnboardingReplay()` existed in `lib/onboarding.ts` with a
  live listener in `onboarding-gate.tsx`, but no button anywhere called it. Added one next
  to "User guide" in both `app/settings/page.tsx` (Manager) and
  `app/driver-v3/settings/page.tsx` (Driver), in en/es/fr.
- Updated the affected tests to check the new call sites/behavior instead of the removed
  screen, plus two unrelated copy-wording drifts caught along the way (onboarding slide
  text had been reworded since the test was written).
- **`npm test`: 149/149 passing** - 0 failures, down from the original 10.
- `npm run typecheck`, `npm run build` clean.

### Stage 17 — Today rebuilt to the new MapLibre reference: real map, two-state layout
Full rebuild of Driver Today's hero per the user's detailed spec, replacing the
Leaflet-based `DriverRoutePreview` with a MapLibre-based map and reordering/restructuring
the whole hero around a two-state (before start / started) layout.

- **New map stack: MapLibre GL JS + real OpenStreetMap tiles, no key.** Added
  `components/driver-v3/DriverRouteMap.tsx` - a single MapLibre `Map` instance created
  once on mount and never recreated. Driver location (blue, pulsing) and destination
  (gold/teal pin) are `maplibregl.Marker`s whose `setLngLat()` is called on every GPS fix;
  the connecting line is a GeoJSON source whose `setData()` is called the same way - no
  part of the map re-initializes on a location update, only marker positions and the
  line's coordinates change. `interactive: false` disables all pan/zoom/click (context
  only, never navigation). Dark look is a CSS `invert()+hue-rotate()` filter on MapLibre's
  own canvas (OSM only ships a light style; same trick already used for the Leaflet
  version), with a light-mode override that removes the filter. A radial CSS mask fades
  the map to transparent at every edge so it dissolves into the hero card instead of
  showing a rectangle, matching the "mapa integrado... sin borde rectangular duro"
  requirement.
- **Driver's live position feeds the map for free.** `liveFix` was already tracked
  end-to-end (`useDriverLiveLocation` → `useDriverData()`) for the fleet map elsewhere -
  reused it directly instead of starting a second, redundant geolocation watch.
- **Hero reordered**: the map now comes first (large, 42vh before the stop starts,
  clamped so short/narrow devices from the existing responsive breakpoints still fit with
  no scroll), followed by the type pill, stop progress, destination name/address/PO,
  distance/time, then the CTA.
- **Two-state layout, driven by the same persisted `phase` the app already used** (not a
  new local flag, so returning from external Maps lands back on the same state instead of
  resetting to "start"): before the stop starts, the map is large and Maps/Call/Issue are
  hidden entirely; once started, `.routeGlyphHostCompact` shrinks the map to 23vh with a
  CSS transition, and a `.secondaryRow` of Maps/Call/Issue buttons fades/slides in under
  the CTA. Phone number and driver note (when present) now show once started too.
- **CTA now has three real states**, reusing `driver-state.ts`'s existing
  pending/started/arrived phases that the hero previously collapsed into just two: "Start
  X" before starting, "Arrived at stop" once started but not yet arrived, "Complete X"
  once arrived - each still calls exactly the same handler as before (label-only change,
  the actual `run()` functions for every kind are untouched).
- **Removed the header's 3-dot Tools sheet** (`today-tools-sheet.tsx`, now unused but left
  in place) now that Maps/Call/Issue live inline in the hero instead - one place for these
  actions instead of two.
- `app/driver-v3/route-glyph.tsx` and `components/driver-v3/DriverRoutePreview.tsx`/
  `.module.css` (the Leaflet version) are now unused, left in place rather than deleted.
- `npm install maplibre-gl`; `npm run typecheck`, `npm run build` clean; `npm test`:
  149/149 still passing (no operational handler was touched, only labels/layout/the map
  component itself).

### Stage 18 — "at destination" state, no fake route line, full validation sweep
Refinement pass against a second, more detailed version of the Stage 17 spec (same
reference image). Most of it already matched (map-first layout, two-state hero, inline
Maps/Call/Issue after start, phase-driven state survives external Maps); the one real gap:

- **"Si distancia es 0, mostrar estado 'En destino'; no mostrar una ruta falsa."** Added
  a distance check to `DriverRouteMap.tsx` (`distanceMeters` from `lib/location.ts`,
  reused rather than re-implemented): under 45m between the driver and the destination,
  the line source is cleared (`FeatureCollection` with no features, not a near-zero-length
  line) and a small "At destination"/"En destino"/"Sur place" pill fades in over the map
  instead. Localized via a `locale` prop threaded from `page.tsx`.
- Ran the full validation sweep the spec explicitly asked for -
  `typecheck`/`lint`/`test`/`build`, not just the first three used in earlier stages.
  `lint` surfaced one real new warning (`DriverRouteMap.tsx`'s GPS-update effect
  intentionally depends on `driverFix.lat/lng` instead of the object reference, so a
  same-coordinates re-render doesn't reset the map) - annotated with an explained
  eslint-disable rather than either silencing it blindly or "fixing" it into a bug.
  Confirmed no other file introduced a new warning (every other warning in the report
  predates this work).
- `npm test`: still 149/149.

### Stage 19 — fixed the map's actual dark color, and a real "no line when no GPS" gap
The user sent a live screenshot of the deployed map next to the reference again: the dark
style was rendering as blotchy green/yellow patches instead of clean navy, and with no
live GPS fix the map showed only the destination pin with no line at all (matching a
reading of the spec, but not what the reference always shows).

- **Fixed the dark tile color, verified with a real rendered screenshot before shipping**
  (same discipline as every dark-mode check earlier this session - never trust a filter
  recipe by description alone). The old `invert() + hue-rotate()` chain shifted OSM's many
  different tile hues (green parks, tan buildings, blue water) unpredictably, since
  hue-rotate turns each of those differently. Rebuilt it as `grayscale(1)` first (removes
  all that hue variance) → `invert(1)` (flips the now-flat image dark) → `sepia(.6)
  hue-rotate(190deg) saturate(2.6)` (re-tints the single resulting gray into one uniform
  RouteHub navy instead of many mismatched colors). Rendered it with a local Playwright
  harness (MapLibre's real ESM build, real OSM tiles) before touching the shipped
  component - confirmed clean navy streets/labels close to the reference, not assumed.
- **Added a route-origin fallback** (`components/driver-v3/DriverRouteMap.tsx`): when
  there's no live `driverFix` yet (GPS permission not granted, Driving Day not on, no
  signal indoors), the map now falls back to the route's own `origin_lat/origin_lng` (or
  geocodes `origin_address`) so it still draws a real line instead of showing only a lone
  pin. The fallback marker uses the same blue dot but without the pulse animation
  (`.driverDotStatic`), since a static stand-in shouldn't read as a live signal. "At
  destination" only ever triggers off a real live fix - a route whose static origin
  happens to equal its destination isn't the driver actually being there.
- **Fixed a real bug found while building the fallback**: both the destination and origin
  coordinates were held in refs, not React state - a geocoded result (no `lat/lng` on the
  record, resolved from the address) arrived asynchronously and never triggered the map's
  own update effect, so a stop needing geocoding could silently show no marker at all.
  Replaced both with a small `useResolvedPoint` hook backed by `useState`.
- `npm run typecheck`, `npm run lint` (no new warnings), `npm run build`, `npm test`
  (149/149) all clean.

### Stage 20 — the map's fade was the wrong shape entirely
The user pointed specifically at "la difusión del mapa" - it didn't match the reference.
Looking again, the mismatch wasn't subtle: the reference map runs full-bleed to the
screen's left/right/top edges with no fade at all there, and only dissolves downward into
the card near the bottom. The shipped version instead inset the map 18px inside the card
on every side and faded it with a *radial* vignette (soft on all four sides, like a blob
in the middle) - a completely different shape from a top-to-bottom fade.

- `app/driver-v3/today.module.css` - `.routeGlyphHost` (and its three responsive
  breakpoint overrides) now use negative margins to cancel `.hero`'s own padding exactly,
  so the map spans the card's full width and reaches its top edge instead of sitting
  inset - rounded only at the top (`border-radius: <hero's own radius> <same> 0 0`) to
  match the card's corners exactly where the map's edge lands on them.
- `components/driver-v3/DriverRouteMap.module.css` - replaced the radial
  `mask-image` with a linear one (`to bottom, #000 0% 62%, transparent 96%`): fully
  opaque through the top ~60%, fading out only in the last stretch before the pill/text
  begins. No fade on the sides at all now, matching the reference's edge-to-edge look.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 21 — dropped the swipe-to-next-route strip for a bigger map; fixed the estimate icons
The user liked the map fade fix ("mucho mejor") and asked to remove the swipe-for-next-
route strip entirely so that reclaimed space goes to an even bigger map, plus to compare
the distance/time chips against the reference.

- **Removed `.routeSwipeZone`** (the "Swipe up for the next route" / "No more pending
  routes" strip below the hero) from `app/driver-v3/page.tsx`, along with the
  `routeSwipeAction`/`routeSwipeStart`/`routeSwipeEnd` handlers and `swipeStartY` ref that
  existed only for it - the `.nextChip` card above it already gives a tap-based way to see
  the next stop, so this wasn't the only way in or out.
- **Grew the map** into the reclaimed space: `.routeGlyphHost` (all 3 responsive
  breakpoints included) went from 42vh to 47vh before the stop starts (43/36/31vh on the
  narrower/shorter breakpoints), and the compact started-state height grew proportionally
  too (23vh → 25vh, etc.).
- **Fixed a real mismatch in `DriverRouteEstimate`**: the distance and time chips both used
  the exact same blue icon tint - the reference clearly uses blue for distance and amber/
  gold for time. Added a `.iconTime` variant and applied it only to the clock icon. Also
  sized the chips up slightly to match the reference's visual weight (icon box 34px→38px,
  number 22px→24px, divider 34px→36px), with the same proportional bump on its own
  narrow-screen breakpoint.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 22 — missing address pin icon, and an oversized gap under short names
The user circled the exact cluster (map bottom through the PO/distance/time row) on the
reference and sent a matching current-state screenshot side by side. Two real, precise
differences:

- **No pin icon before the address** - `app/driver-v3/page.tsx`'s address line was plain
  text (`<p>{route.destination_address}</p>`), the reference clearly shows a small location
  pin before it. Added one (`lucide-react`'s `MapPin`), restyled `.addressLine` as a flex
  row so the icon and the (still line-clamped) address text sit side by side instead of the
  icon needing its own inline hack.
- **A visibly oversized gap between the destination name and the address below it for
  short (the common case) one-line names.** `.identityBlock h1` had `min-height: 58px` -
  clearly sized to reserve room for a two-line name, but the heading's own font-size/
  line-height (34px/1.08) only needs ~37px for one line, so a short name like "OPA LOCKA"
  left ~21px of dead reserved space before the address started. Corrected the reservation
  to match one real line (37px, scaled down at the three responsive breakpoints too) - a
  genuine two-line name still just grows the block naturally.
- `npm run typecheck`, `npm run build`, `npm test` (149/149) all clean.

### Stage 23 — glass treatment for the distance/time icon chips
The user liked the overall result ("se ve mucho mejor") but asked for the distance/time
icon chips specifically: smaller, more vivid color, more "crystallized"/glowing - the same
glass language already used on the CTA and the map's own markers, not yet applied here.

- `components/driver-v3/DriverRouteEstimate.module.css` - `.icon`/`.iconTime` rebuilt with
  the same glass recipe as the rest of the app: a vivid gradient fill (blue for distance,
  amber for time) instead of a flat rgba tint, a tinted 1px border, an inset top highlight,
  and an outer glow - and sized down from 38px to 30px (26px on the narrow-screen
  breakpoint) so it reads as a compact accent, not a second button.
- Added a light-mode override (this component never had one before) since the new dark
  colors were tuned for a dark background - softer fill, darker glyph color, so it reads as
  vivid glass on a pale card instead of low-contrast pastel.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 24 — corrected the PO/distance/time row from a real zoomed reference
The user sent a screenshot zoomed to real iPhone scale of just this one row. It showed two
things Stage 23's own read of the reference had gotten wrong:

- **Single-line value text, not a stacked big-number-then-small-label pair.** The zoomed
  crop shows "PO 048472", "7.8 mi", "14 min" each on one line next to their icon, no
  separate muted caption underneath - `DriverRouteEstimate` had been rendering a large bold
  number with a small label below it since Stage 17. Rebuilt the row as icon + single-line
  value.
- **PO belongs in the same row as distance/time, not its own separate line above it.** The
  reference shows all three - PO, distance, time - in one row with matching circular icons
  and dividers between them. `DriverRouteEstimate` now takes an optional `poNumber` prop
  and renders it as the row's first item (PO violet, distance teal, time amber - three
  distinct accents); `page.tsx`'s separate `.poLine` paragraph was removed in favor of
  passing `poNumber={kind==='pickup'&&route.order_number?route.order_number:null}`.
- **Icon badges are circles with a thin colored outline and a near-transparent fill**, not
  the filled gradient-glow squares Stage 23 had just added - corrected to match the
  reference exactly.
- Updated `tests/stop-workflow.test.mjs`'s PO assertion to check the new prop/location
  instead of the old inline `<p>` line it replaced.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Not done yet (real, not hidden) — superseded, see Stage 19's own note below
Everything below this line was accurate as of Stage 1 and is now stale - kept for history
rather than rewritten in place. `useManagerLightTheme()` was removed in Stage 2;
Manager renders dark by default today. The near-white-background sweep this note flagged
was completed across Stages 2-8 (verified again just now, Sept 2026: a repo-wide grep for
`#fff`/`#f8fafc` card backgrounds under `app/manager`, `app/routes`, `app/contacts`,
`app/settings` finds only 4 files, and every one of them already has a matching
`html[data-theme='dark']` override next to it - `history.module.css`,
`add-route-desktop.css`, `new-route-ui.module.css`, `routes.module.css`). Admin/CEO and
Login/Onboarding remain explicitly out of scope per the user's own later instruction
("ceo admin dejalos fuera no necesiton esto"), not because they were forgotten.

- ~~**Manager still renders light-only.**~~ Fixed in Stage 2.
- ~~**~19 files still hardcode a near-white card background**~~ Fixed across Stages 2-8,
  reconfirmed above.
- ~~Border colors... also unconverted.~~ Covered in the same sweeps.
- ~~Admin/CEO, Login/Onboarding... have not been started.~~ Still true, but by explicit
  user instruction, not oversight - see above.


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
