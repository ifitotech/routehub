# Changelog

### Stage 46 — Extend the Today map into stop details

Expanded the existing MapLibre preview downward behind the Today stop details,
using compensating negative flow space so the operational content keeps its
position. The map now sits behind the badge, stop label, destination, address,
and metrics and fades out through that area. The top mask uses the same deep
navy base in dark mode and a pale base in light mode, removing the hard seam
while preserving the existing header controls and route behavior.

### Stage 45 — Header/map seam fade

Adjusted only the real MapLibre map's top mask on Driver Today so its canvas
fades in from transparent into the existing navy header, matching the supplied
reference without changing the header controls, layout, or content. The lower
map fade remains intact. No route data, navigation behavior, or decorative
content was changed.

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

### Stage 25 — PO always reserves its space; the map now merges into the header
- **PO's slot in the row is now always present**, even for Delivery/Return (no PO at all)
  or a Pickup missing an order number - `DriverRouteEstimate` used to only render the PO
  metric+divider when `poNumber` was truthy, so distance and time shifted left to fill the
  gap on every stop that didn't have one. Now the PO metric and its divider always stay in
  the DOM at the same width; without a real `poNumber` they're set to
  `visibility:hidden` (not removed, so the layout space is still reserved) instead of being
  conditionally rendered - distance and time land in the exact same position on every stop
  type instead of the row visibly jumping around.
- **The map now flows directly out from under the header instead of reading as a separate
  boxed card below it.** Two changes: `.page` lost its 12px top padding (the map, the
  hero's first element, now sits with zero gap against the header above it), and
  `.routeGlyphHost` lost its top `border-radius` (flat/square top edge at every breakpoint,
  not rounded) - a rounded card floating just under the header read as "a box," a flush,
  flat-topped one flowing straight out from behind it does not.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 26 — the whole hero card still read as a box, not just the map
The user pointed out that even with the map merged into the header, everything below it
(pill, name, address, PO row, CTA) still visibly reads as its own floating rectangle - a
distinct card background, a 1px border, and a `0 18px 48px` drop shadow all signal "a
separate raised surface," most visible at the card's own rounded bottom corners against the
page background. The reference doesn't show any such boundary - content just sits directly
on the app's own background.

- `app/driver-v3/today.module.css` - `.hero` no longer has its own background, border, or
  box-shadow (all set to `transparent`/`0`/`none`). Padding stays, since the map's own
  negative-margin math still needs it to reach the card's former edges, but there's no
  longer a border/background for that padding to visually contain. Everything below the
  map now sits directly on `.page`'s own dark gradient background - only the CTA button
  still gets its own glass treatment, since it's meant to read as a distinct control, not
  a grouping container.
- `--rh-card-bg` (the token this removed) is still used by `.stateCard` (the empty/error
  state message), which is unrelated and correctly still looks like a card.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 27 — found the real seam: .content's own padding/background, not .hero
Removing `.hero`'s own card surface (Stage 26) wasn't enough - the user still saw the whole
map+content area reading as a distinct box. The actual cause was one level up: the shared
shell's `.content` (`driver-v3-a.module.css`, every Driver screen wraps its content in it)
has its own flat background *and* its own `16px/18px/28px` padding around whatever it
holds. `.page`'s rich gradient background only ever painted inside that padding - `.content`'s
plain flat color was exposed as a visible frame around it the entire time, which is what
still read as "a box" even with `.hero` itself fully transparent.

- `app/driver-v3/today.module.css` - rather than edit `.content` itself (every other
  Driver screen depends on that padding for normal, card-based layouts), `.page` now
  breaks out of it with a matching negative margin (`-16px -18px -28px`) so its own
  gradient background paints across the *full* area instead, then restores the same
  padding for its own children - net position unchanged for everything except the map,
  which keeps the zero top padding from Stage 25 so it still sits flush against the
  header. `.pullScene` (the pull-to-refresh truck) got its own `top` nudged from 24px to
  40px to compensate for `.page`'s box now starting 16px higher.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 28 — reverted Stage 27's approach; fixed the map's own color match instead
The user didn't like Stage 27's fix and asked directly for it to be reverted, and for the
same fade technique already used to blend the map with its surroundings to be the one doing
the work here too - not a box-model trick.

- Reverted `.page` and `.pullScene` in `app/driver-v3/today.module.css` back to their
  pre-Stage-27 values (no negative margin/width/padding changes, `.pullScene` back to
  `top: 24px`).
- **Fixed what was actually still causing a visible seam**: `DriverRouteMap.module.css`'s
  `.host` rested on a flat, guessed hex color (`#0b1526`) instead of the same
  `--rh-page-bg` gradient token `.page` itself uses - wherever the map's own mask fades
  toward transparent (see Stage 20), it was blending toward a color that never quite
  matched the richer gradient underneath it, leaving a faint but real seam right at that
  boundary. `.host` (both themes) now uses `var(--rh-page-bg)` directly, so the map's
  resting color and its fade target are the same gradient family the rest of the page
  already uses, instead of a second, slightly-off color standing in for it.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 29 — the outer frame, fixed with an existing "full bleed" mechanism
Asked directly where exactly the box was, the user confirmed it was the whole outer
boundary around the entire hero (map through the CTA), not a seam in one specific spot -
confirming the diagnosis from Stage 27 was right, even though its specific fix got reverted.

- **`app/driver-v3/page.tsx` now passes `flush` to `DriverV3Shell`** - a prop that already
  existed and is already used by the Map screen (`app/driver-v3/map/page.tsx`), instead of
  a new box-model trick. `flush` applies `.contentFlush` (`driver-v3-b.module.css`), which
  removes the shared `.content` wrapper's own `16px/18px/28px` padding entirely
  (`padding:0!important`). Without that padding, there's no gap left for `.content`'s flat
  fallback background to show through - `.page`'s own gradient now covers the *complete*
  area, edge to edge, instead of only the area inside padding that used to expose a frame
  around it. `.hero`'s own 18px padding still gives the text/button content the same inset
  it always had; the map still reaches those same edges via its existing negative margins,
  except those edges are now the screen's true edges instead of edges already inset by
  `.content`'s padding.
- Lower-risk than either earlier attempt: no shared component's background was changed
  (unlike a `.content` background edit, which would have touched every Driver screen), and
  no manual margin/width arithmetic was needed (unlike Stage 27) - `flush` is a proven,
  already-shipped pattern for exactly this "this screen owns its own full-bleed background"
  case.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 30 — the top bar now shares the hero's own gradient, scoped to Today only
With `flush` removing the outer frame (Stage 29), the header still met the map with a flat,
differently-colored bar right above it - the fused surface stopped one edge too early.

- **`components/driver-v3/DriverV3Shell.tsx`** — added `data-active={active}` to the
  `<header>` element, so a single CSS rule can target "the header, only when Today is the
  active screen" without touching History/Truck/Settings/More, whose own content doesn't
  reach up to meet the header the same way.
- **`components/driver-v3/driver-v3-b.module.css`** — added
  `.appHeader[data-active='today']{background:var(--rh-page-bg,#0F1D35) !important}` right
  after the base `.appHeader` rule, reusing the same `--rh-page-bg` token `.page` and the
  map's own `.host` already use (Stage 28), so the header's background is the exact same
  gradient the hero flows into, not a separately guessed color. Added a matching light-mode
  override with the `[data-active='today']` attribute on the selector too (not just added
  after it in source order), since two tied `!important` rules resolve by specificity, and a
  plain `.appHeader` selector by itself doesn't win over the existing
  `html[data-theme='light'] .driver-v3-root .appHeader` override on its own. That light
  override also drops the header's `box-shadow` (the thin bottom border it normally carries)
  so no seam line is left under the header once the background already matches.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 31 — the confirm dialog now opens out of the bottom bar, hero tucks into the header
Asked for the "Complete this pickup?" confirm dialog to rise out of the bottom bar with a
nicer effect, and for the map/hero behind it to visually recede up into the header while it
opens - not just a dialog stacked flat on top of the page.

- **`app/driver-v3/today.module.css`** — new `.pageShrink` modifier on `.page`: while the
  confirm dialog is open, the whole hero (map through the CTA) scales to .94 and shifts down
  22px with top corners rounded to 26px, transitioning on an iOS-style spring
  (`cubic-bezier(.32,.72,0,1)`, .34s). Transform-origin stays at the top so the visible
  change is concentrated at the top edge - the sliver of gap that opens up there is what
  reads as "the map tucking into the header," while the bottom stays put since the confirm
  sheet already covers it and the nav is already hidden (`hideNav`) whenever this dialog is
  open.
- **`components/driver-v3/driver-v3-b.module.css`** — `.content[data-active='today']` now
  also gets the `--rh-page-bg` gradient (same token as the header, Stage 30, and the page
  itself). Without this, the gap `.pageShrink` opens up would have exposed `.content`'s own
  flat resting color instead of the same gradient the header already uses - reintroducing
  exactly the kind of "flat box behind the real surface" seam Stage 27-29 spent three rounds
  fixing, just in a new spot.
- Confirm dialog's own entrance (`.confirmSheet`) got a bigger, springier rise
  (`confirmSheetUp`, .38s, same easing) instead of the small 22px nudge every simple confirm
  dialog used before - it now reads as coming up out of the bottom bar, paired with the page
  shrinking behind it. This is shared by every Driver confirm dialog (Manager's own confirm
  dialogs live in a separate CSS module and are unaffected).
- **`components/driver-v3/DriverV3Shell.tsx`** — added `data-active={active}` to the
  `.content` section too (the header already got this in Stage 30), so the new background
  rule above can be scoped to Today only.
- **`app/driver-v3/page.tsx`** — moved the confirm dialog out from being a child of `.page`
  to a sibling of it. `.pageShrink` puts a `transform` on `.page`, and CSS spec makes any
  transformed element the containing block for its own `position:fixed` descendants - left
  nested, the dialog's backdrop would have been confined to `.page`'s own (now shrunk) box
  instead of covering the full viewport, once the dialog it belongs to actually opened.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 32 — the detail sheets were still stuck on the old light-only look
A screenshot of the Delivery sheet showed a plain white card (hardcoded `#f7f9fc`/`#fff`
backgrounds, `#e5eaf0` borders) sitting inside an otherwise fully dark screen - the one
surface in Today that hadn't been touched since before the dark-premium redesign.

- **`app/driver-v3/today-sheets.tsx`** (Info/Pickup/Return/Next-stop/Delivery sheets) — the
  shared `dialog` style object, the header's close button, the PO callout box, and every
  text input/textarea now read `--rh-card-bg`/`--rh-border`/`--rh-text`/`--rh-text-muted`/
  `--rh-surface-soft` (driver-theme-tokens.css) instead of hardcoded hex. These are inline
  React styles, not a stylesheet rule, so the old hardcoded colors weren't just wrong for
  dark mode - they were literally overriding the global dark `input`/`textarea` rule that
  already existed in `driver-v3-a.module.css` (inline styles beat external stylesheet rules
  without `!important`), which is why "Recipient name" rendered on a solid white field even
  in dark mode. The "asking for a name" highlight (`#fff7ed`/`#fdba74`, a flat pastel that
  only read right on white) became a translucent warning tint that works on either card
  background. The signature pad's canvas stays a fixed light surface in both themes on
  purpose - ink needs a paper-like background to read, same as a physical delivery slip.

### Stage 33 — the header/content/map gradient still didn't line up on the "started" (compact map) state
Comparing the pre-start screen (large map) against the started screen (compact map, "Stop 2
of 2"), the header→map fusion from Stage 30 still showed a visible seam on the started state.

- **Root cause**: Stage 30/31 gave the header, `.content`, `.page`, and the map's own `.host`
  each their *own* copy of the same `--rh-page-bg` CSS gradient. A CSS `background` paints
  relative to the element's own box - four separately-sized boxes independently painting "the
  same" gradient puts each one's radial highlight in a different spot. On the tall pre-start
  map this was easy to miss (the highlight landed somewhere plausible); on the short compact
  map after Start, the mismatch became an obvious flat, differently-toned strip right under
  the header.
- **Real fix**: paint the gradient exactly once, on `.shell` - the single ancestor that
  actually spans header + content + nav - and make everything nested inside it for Today
  (header, `.content`, `.page`, the map's `.host`) transparent instead. One shared paint
  layer shows through every layer above it, pixel-aligned, instead of each layer redrawing
  its own copy that can drift out of alignment with the others.
- **`components/driver-v3/DriverV3Shell.tsx`** — added `data-active={active}` to `<main
  className={styles.shell}>` too (header and `.content` already had it from Stage 30/31).
- **`components/driver-v3/driver-v3-b.module.css`** — `.shell[data-active='today']` now
  carries the gradient; `.appHeader[data-active='today']` and `.content[data-active='today']`
  changed from painting their own copy to `background:transparent !important`.
- **`app/driver-v3/today.module.css`** — `.page`'s own `--rh-page-bg` background removed
  (now `transparent`).
- **`components/driver-v3/DriverRouteMap.module.css`** — `.host`'s own `--rh-page-bg`
  background removed in both themes (now `transparent`).
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 34 — reverted the header gradient; the fuse was never meant to reach that high
Corrected: the "fuse into one surface" effect was always meant to be the map blending
into the stop info/content beneath it, not the map reaching up into the header above it -
Stage 30/33 extended the gradient into the header itself, which wasn't what was asked for.

- **`components/driver-v3/driver-v3-b.module.css`** — removed `.appHeader[data-active=
  'today']` and its light-mode counterpart entirely. The header is back to the same plain
  flat bar every other Driver screen uses (`#0F1D35` dark / `var(--rh-navy)` light), same as
  before Stage 30.
- **`components/driver-v3/DriverV3Shell.tsx`** — removed `data-active` from `<main
  className={styles.shell}>` and from `<header>` (neither needs it anymore); `.content`
  keeps it, since that's still the single element painting `--rh-page-bg` for the page and
  map to share below it (Stage 33's fix for the compact-map seam is otherwise unchanged -
  `.content[data-active='today']` still paints the gradient once, `.page`/`.host` stay
  transparent).
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 35 — closed the gap between the secondary row and the nav; round icon buttons
The started state (compact map) left visible dead space between Maps/Call/Issue and the nav
bar - `.page`'s vertical centering, meant for the taller pre-start layout, split the compact
layout's extra slack evenly above and below instead of letting the row sit against the nav.

- **`app/driver-v3/today.module.css`** — new `.pageStarted{justify-content:flex-end}`,
  applied only while `started` is true, so the pre-start layout (which still benefits from
  centering on a tall screen) is untouched.
- Maps/Call/Issue (`.secondaryAction`) rebuilt from boxed tiles to round icon buttons per the
  approved reference: a circular `.secondaryActionIcon` (glassy radial fill, no flat card
  background) with the label underneath, not a bordered rectangle.
- Added `.startedHandle`, a small decorative pill under the row, echoing the divider between
  the action row and the nav bar in the reference image - no swipe behavior attached, purely
  visual.
- **`app/driver-v3/page.tsx`** — `started ? styles.pageStarted : ''` added to `.page`'s class
  list; the three secondary buttons now wrap their icon in `.secondaryActionIcon`; the handle
  renders right after the row, only while started.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 36 — the map tucks under the header with a fade, not a header color change
The header/map "fusion" was reverted in Stage 34 because changing the header's own color
wasn't the right idea - but the hard cut where the flat header bar instantly became map
tiles, no transition at all, was still real and still needed fixing.

- **`components/driver-v3/DriverRouteMap.module.css`** — added `.host::before`, a 56px-tall
  gradient overlay pinned to the map's own top edge that fades from the header's exact flat
  color (`#0F1D35` dark / `var(--rh-navy)` light) down to transparent. The header itself is
  untouched (still the plain flat bar from Stage 34); the map's *own* top edge now reads as
  tucking under it instead of stopping dead against it - the fusion lives entirely on the
  map's side of the seam, not the header's.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 37 — removed the "next stop" preview chip; that space stays the same either way
Asked to remove it because it broke the new design - the space under the hero has to look
identical whether or not there's a queued route after the current one, not show a teaser
for it.

- **`app/driver-v3/page.tsx`** — removed the `.nextChip` button and the `sheet==='next'`
  overlay (`NextStopSheet`) entirely, along with the now-unused `nextRoute`/`nextKind`/
  `nextLabel`/`NextStopIcon` locals and the now-unused `ChevronRight`/`NextStopSheet`
  imports. The stop counter ("Stop 2 of 2") is unaffected - it already reads
  `snapshot?.queue.upcoming?.length` directly, not through any of the removed next-stop
  variables.
- **`app/driver-v3/today-sheets.tsx`** — `NextStopSheet` itself left in place (it's still a
  correctly-typed, working component, just currently unused - same "don't delete working
  code just because nothing calls it yet" convention as the dead `.routeSwipeZone` CSS from
  Stage 21).
- **`tests/maps-provider.test.mjs`** — updated the Today assertions: now asserts the removed
  next-stop chip/sheet markers are absent (`nextChip`, `sheet==='next'`) instead of asserting
  they exist.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 38 — contact name surfaced for the driver; the map/header handoff softened further
Two asks: (1) delivery stops already saved a `destination_contact_name` (the route builder
has had this field since migration 041) but Today never showed it anywhere, so the driver
had no way to see who to ask for at the door; (2) the map/header seam was still visible,
especially over rural/empty map tiles, which render almost solid black through the dark-tile
filter and can be much darker than the header's flat navy.

- **`app/driver-v3/page.tsx`** — the contact name now renders on the main card (same
  `.phoneLine` styling as the phone number, right above it), once started - matching where
  the phone number already appears.
- **`app/driver-v3/today-sheets.tsx`** — `InfoSheet` (opened by tapping the stop name/address)
  now also shows the contact name, right above the Call button.
- **`components/driver-v3/DriverRouteMap.module.css`** — the map's own mask now also fades
  in over its first 8% (previously only faded out at the bottom), so very dark tiles don't
  snap straight to full opacity right where the header-color overlay (`.host::before`, Stage
  36) ends. That overlay itself grew from 56px to 72px and switched from a plain two-stop
  fade to a three-stop one (full color → half → transparent), since a straight linear fade
  reads as ending abruptly partway through.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 39 — smaller compact map, room given back to the contact detail
Asked to shrink the map further (once started) so the freed space goes to the delivery/
pickup contact info, not to blank room.

- **`app/driver-v3/today.module.css`** — `.routeGlyphHostCompact` reduced across all four
  breakpoints (e.g. 25vh/100-180px → 19vh/84-140px on the base size). Contact name + phone
  moved out of two plain `.phoneLine` paragraphs into a new `.contactBlock` - a small
  labeled surface (icon + name, icon + phone) that actually uses the freed room instead of
  leaving it blank, matching `.noteLine`'s soft-surface treatment.
- **`app/driver-v3/page.tsx`** — the identity block now renders `.contactBlock` (with
  `UserRound`/`Phone` icons) instead of the old plain-text phone line, once started.
- **`components/driver-v3/DriverRouteMap.module.css`** — `.host::before` (the header-color
  overlay from Stage 36/38) switched from a fixed `72px` to `height:24%` (capped at
  `max-height:72px`). A fixed px value would have covered most of the now-much-shorter
  compact map (as small as ~62px) instead of just fading its top edge; a percentage scales
  down with the map automatically.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 40 — a real blue-to-teal route line; notes joined the contact block; a simpler map/header fade
Three things from the same round of feedback: the route line on the map was a single flat
color, not the blue-at-origin/teal-at-destination gradient from the original approved
reference; delivery/pickup instructions belonged in the same block as the contact name and
phone, not a separate line further down the card; and the map/header overlay from Stage 36/
38/39 was itself starting to look like a second flat bar rather than a blend.

- **`components/driver-v3/DriverRouteMap.tsx`** — the route line's source now sets
  `lineMetrics: true`, and both the glow and core layers use a `line-gradient` (blue `#2493FF`
  at the origin end to teal `#37E0C9` at the destination end) instead of one flat color per
  layer - matching the original abstract-glyph reference's own coloring, now on the real map.
  Line widths also scale with zoom (`interpolate` on `['zoom']`) instead of one fixed width,
  since a long route (tens of miles) fits to a much wider-open zoom where a fixed-width line
  read as too thin to notice.
- **`app/driver-v3/page.tsx`** / **`today.module.css`** — `driver_note` moved out of its own
  `.noteLine` paragraph (further down, under the PO/distance/time row) into a third row
  inside `.contactBlock`, right alongside the contact name and phone - one place for "info
  the driver needs at the door," not three separate locations on the card. New
  `.contactRowNote` variant allows wrapping and uses the muted/subtle text tone, since a note
  can run much longer than a name or phone number.
- **`components/driver-v3/DriverRouteMap.module.css`** — `.host::before` (the header-color
  overlay) simplified back to a plain two-stop fade and shrunk (24%/72px max → 16%/46px max).
  The three-stop version held near-full color through roughly its first half, which read as
  its own small solid bar sitting under the header rather than a blend - the same "doesn't
  look like one thing" complaint, just relocated. A shorter, immediate fade keeps the color
  match right at the header's edge without lingering as a visible block of its own.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 41 — Routes (history) and Truck adapted to the dark theme; hardened the scroll lock
Asked to adapt Routes and Truck to the new interface, and reported Settings as locked with no
scroll (cause not found by reading the code - see below).

- **`app/driver-v3/history/page.tsx`** (the "Routes" tab) — this whole screen had never been
  touched since before the dark-premium redesign: status colors (`tone()`), the date/search
  inputs, and the pending/done tab buttons were all hardcoded flat light hex (`#fff`,
  `#DDE5EE`, `#EAF2FF`, pastel status backgrounds like `#FFF1F2`/`#ECFDF3`/`#FFFBEB`) as
  inline styles - same bug shape as Stage 32's Today sheets: inline styles silently beat the
  global dark `.card`/input rules regardless of theme. Converted every one of them to
  `--rh-*` tokens or a translucent rgba tint of the same accent color (danger/success/
  warning), so status cards read as a tint on top of the current theme's card surface
  instead of a fixed pastel that only worked on white.
- **`app/driver-v3/truck/fuel/page.tsx`** / **`app/driver-v3/truck/maintenance/page.tsx`** —
  same fix for their smaller pockets of hardcoded hex (the ok/error status banner, the
  selected maintenance-type chip). The main Truck screen itself (`truck/page.tsx`) was
  already clean - it only used the shared `.card`/`.primary`/`.secondary`/`.row` classes,
  which already have dark overrides.
- **`app/driver-v3/page.tsx`** — hardened the sheet-open scroll lock as a precaution (could
  not reproduce the reported Settings freeze by reading the code, so this is a real but
  unconfirmed candidate, not a verified fix): its cleanup now always resets
  `document.documentElement`/`body` `overflow` back to `''` instead of restoring whatever
  value was captured when the lock was applied - nothing else in the app sets that property,
  so there's no legitimate other value to restore, and restoring a captured value was the one
  way this global, unscoped lock could theoretically carry over to another screen instead of
  clearing itself.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 42 — actually rendered the header/map seam instead of guessing at it again
Marked up a screenshot circling the header and the band right below it, still reading as two
separate things after five rounds of CSS-only guesses (Stage 36/38/39/40). Instead of a sixth
guess, built a throwaway static-HTML harness reproducing the exact compiled CSS and rendered
it with Playwright (the same discipline already used once before for the dark-tile filter
recipe, Stage 19) - actually seeing the pixels instead of reasoning about them blind.

Two real bugs found this way, not previously visible from reading the CSS alone:
- **The overlay was silently defeated by the map's own mask.** `.headerFade` lived on
  `.host::before`; `.host`'s `mask-image` applies to its *entire* painted box, pseudo-elements
  included - the overlay's own top edge (meant to be the most opaque, header-matched point)
  was being faded toward zero by the mask's own top-fade-in at the exact same spot. Rendering
  it confirmed the "fix" was doing close to nothing. Moved to a real sibling `<div>` in
  `DriverRouteMap.tsx` (`.headerFade`, absolutely positioned next to `.host` inside `.wrap`,
  not inside the masked element), immune to `.host`'s mask entirely.
- **Empty/undetailed map area is much darker than the header, not just a different hue.**
  Worked through the dark-tile filter chain by hand on a typical light OSM basemap color: grayscale
  keeps it light, invert flips it to a very dark gray (~16,16,16), and the existing
  `brightness(.92) contrast(1.05)` pushes it darker still - meaningfully darker than the
  header's navy (15,29,53), which is why routes with a lot of open/rural area at the top of
  frame showed the worst version of this seam. A short color-matched fade can't bridge that
  gap in a few pixels; rendered several heights/gradients and settled on a taller, four-stop
  fade (`.headerFade`, 60% of the map's own height: solid navy through 15%, half-strength by
  45%, transparent by 100%) that reads as one continuous surface at every compact-map size
  tested (62px-140px), not a shorter, faster one that leaves a visible remaining jump into the
  near-black tile color below it.
- **`components/driver-v3/DriverRouteMap.module.css`** — `.host`'s mask-image simplified back
  to a bottom-only fade (the top fade-in it grew in Stage 40 was compensating for the same
  masked-overlay bug above, and is redundant now that `.headerFade` isn't subject to it).
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean. Verification harness (temp npm install of `playwright`, a scratch
  `index.html`/`shot.js`, cached Chromium binary already present from Stage 19) fully removed
  afterward - nothing committed to the repo from it.

### Stage 43 — the map now genuinely extends up behind the header, not a color match
Asked explicitly for this: make the map bigger upward so it goes underneath the header and
truly fuses, instead of another color/fade approximation at the boundary between them.

- **Real occlusion, not another approximation.** `.page` (today.module.css) now extends its
  own box **130px** further up than before (`--map-bleed`), with matching extra top padding
  so every other child (pill, name, address, CTA) stays exactly where it always was - only
  the map (`.routeGlyphHost`/`Compact`, with a correspondingly bigger negative top margin)
  actually reaches into that new head-room. `.content[data-active='today']`
  (driver-v3-b.module.css) switched from `overflow:hidden` to `visible` so that bleed isn't
  clipped right at the boundary it's meant to cross. The header (`z-index:5`, opaque, already
  established) simply paints over whatever part of the map ends up behind it - there is no
  seam to blend anymore because there's nothing visible left at that boundary to blend.
- **`components/driver-v3/DriverRouteMap.module.css`** — `.host` (MapLibre's own container)
  switched from filling its parent completely to being pinned to the *bottom* of it, at its
  original (un-bled) size: `position:absolute;bottom:0;height:calc(100% - var(--map-bleed))`.
  This keeps `.host`'s own size, mask percentages, and MapLibre's `resize()`/`fitBounds`
  framing completely unaffected by the bleed - only *where* the box sits changed, not its own
  dimensions or content. Removed `.headerFade` (Stage 42) entirely; with real occlusion in
  place, a color-matched overlay has nothing left to bridge.
- **Verified with the same Playwright-render discipline as Stage 42, not by inspection alone**:
  built a throwaway harness reproducing this exact structural change, placed test markers at
  the map's own top edge, and confirmed a marker at `.host`'s true top pixel is fully visible
  right at the boundary (nothing hidden that shouldn't be, nothing left showing that should
  be tucked away) before touching the real files.
- Also, separately: routes with a long span between origin and destination (tens of miles)
  were forcing the map to zoom out so far to fit both points that neither read as "close" -
  just a distant, low-detail overview. Past 12km apart, the initial framing now centers on
  the driver's own position at a fixed, closer zoom instead of stretching to fit the whole
  span - this is context for where the driver is right now, not a full-route overview.
- `npm run typecheck`, `npm run build`, `npm test` (149/149), `npm run lint` (no new
  warnings) all clean.

### Stage 44 — found the real bug behind the seam: a silent CSS Modules export collision
Stage 43's geometry was verified correct in isolation, but the seam persisted in production
after shipping it - a sign the real element in the running app wasn't getting the CSS at all,
not that the geometry itself was wrong. Digging into the actual **compiled** output (not just
the source) instead of iterating on the source again found it.

- **The bug**: `driver-v3-b.module.css` had `.content[data-active='today']{...}` (added Stage
  30, renamed at each subsequent stage but never renamed AWAY from the identifier "content").
  CSS Modules hashes every class token it finds in a selector, including ones inside a
  compound/attribute-qualified selector like this - not just a bare `.content{}` rule. That
  gave `driver-v3-b.module.css` its own "content" export, a genuinely different hash than
  `driver-v3-a.module.css`'s. `DriverV3Shell.tsx` merges `{...shellA, ...shellB}`, and a later
  spread key always wins a collision - so the class actually applied to the DOM was **always**
  b's hash, on every Driver screen, regardless of `data-active`. This meant
  `driver-v3-a.module.css`'s real `.content{min-height:0;overflow-y:auto;max-width:680px;
  margin:0 auto;padding:16px 18px 28px;...}` rule - scroll behavior, width, padding, for
  every Driver screen - never matched anything, at all, full stop. Every Today-specific
  background/overflow rule added on `.content[data-active='today']` since Stage 30 (including
  Stage 43's `overflow:visible`, the fix the map's up-behind-the-header bleed actually needs
  to render) was compiling correctly and matching the right element in isolation, but the
  base layout rule it was layered on top of had been unreachable the entire time - explaining
  both the seam surviving every fix aimed at it, and a strong, previously-unconfirmed
  candidate for the separately-reported "Settings is locked, no scroll" bug (missing
  `overflow-y:auto`, on every non-Today screen, not just Settings).
- **The fix**: renamed the rule to `.contentToday` - a distinctly-named class in
  `driver-v3-b.module.css` with no identifier overlap with `driver-v3-a.module.css` at all -
  applied conditionally from `DriverV3Shell.tsx` (`active === 'today' ? styles.contentToday :
  ''`, the same pattern `flush` already uses) instead of via the `[data-active]` attribute
  selector. Verified directly in the compiled build output: the merged `styles` object now
  has exactly one "content" key (`driver-v3-a`'s), and `contentToday` a separate one.
- **Also found, not yet fixed** (flagged for a follow-up, not touched now since neither is
  currently referenced through the merged `styles` object anywhere, so neither has a live
  bug today): `.tag` and `.stickyAction` have the exact same shape of collision between the
  two files - `driver-v3-a.module.css` has each rule's real base styling, `driver-v3-b.
  module.css` has only a same-named dark-mode-only override for each. If either ever gets
  wired up through the merged `styles` object, the base rule would go silently unreachable
  the same way `.content` did.
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

## Stage 47 — 2026-09-14
- Extend the dark/light map fade across the full expanded preview area, eliminating the hard navy band between the map and stop details while preserving the existing Driver Today header and controls.

## Stage 48 — 2026-09-14
- Keep the Today content surface transparent so the enlarged map and its fade remain visible underneath the delivery badge, stop counter, destination and address.

## Stage 49 — 2026-09-14
- Reduce the fade overlay opacity in both themes so the enlarged map remains the dominant visual under Today stop details.

## Stage 50 — 2026-09-14
- Extend the real MapLibre canvas far enough behind the complete Today stop summary, with a continuous late-starting fade modeled on the approved visual reference.

## Stage 51 — 2026-09-14
- Finish the enlarged map with a progressive five-stop dissolve into the Today background, removing the visible lower canvas edge beneath the operational details.

## Stage 52 — 2026-09-14
- Strengthen the header and lower map dissolves, apply dark styling only to the OSM raster layer so route colors remain vivid, and frame both route endpoints even on long missions.

## Stage 53 — 2026-09-14
- Restore the defined navy map treatment with a translucent raster over a navy base, override the global dark-theme rule that painted the Delivery row as a solid block, and add a filter-independent SVG route connection above the map.

## Stage 54 — 2026-09-14
- Blend the Today header into the map in both themes and refit the complete route whenever the responsive map height changes, reserving the lower overlay area so both endpoints remain visible.

## Stage 55 — 2026-09-14
- Extend the Today header fade in both themes, restore light-mode header icon contrast, and slightly strengthen the route glow for clearer presentation on pale maps.

## Stage 56 — 2026-09-14
- Fix the light header selectors so map/profile icons retain contrast, and replace the straight preview segment with the single fastest street route returned by the existing OSRM operations-routing service.

## Stage 57 — 2026-09-14
- Fix the CSS Modules purity error in the light-mode header icon selector so Vercel production builds compile successfully.

## Stage 58 — 2026-09-14
- Remove the light-mode header/map blank seam with a short canvas feather and a transparent top map fade; keep the header controls high-contrast.
- Draw only the fastest real road geometry returned by the routing service, never a straight fallback segment, and use a neutral charcoal treatment for dark map tiles.

## Stage 59 — 2026-09-14
- Rework Today map composition around one full-bleed coordinate space: the MapLibre canvas now reaches behind the header, the lower dissolve begins at the stop details, and the route is fitted to the real available area.
- Verify the compiled production CSS in a mobile Chromium render with a 1,174-vertex OSRM route across light and dark themes; keep the header controls and route colors visible while the map adopts the correct theme treatment.

## Stage 60 — 2026-09-14
- Move the OpenStreetMap attribution from the bottom edge of the map to the upper-right gap between the destination address and contact details, matching the approved Today composition in both themes.

## Stage 61 — 2026-09-14
- Lower the attribution to the upper-right edge of the contact card so it no longer competes with the stop dots or map route.

## Stage 62 — 2026-09-14
- Coordinate the new Today completion flow: opening Pickup, Delivery, or Return completion retracts the map page beneath the fixed header while the existing completion sheet rises with a spring easing curve; closing it reverses the page transition.

## Stage 63 — 2026-09-14
- Apply the completion transition to the new Today sheets themselves: the backdrop fades in and the delivery, pickup, return, and detail panels rise with a spring motion while the map retracts beneath the fixed header.

## Stage 64 — 2026-09-14
- Restore reliable touch handling for completion sheets: the close control and all sheet actions explicitly receive pointer input, and tapping the backdrop closes the panel.

## Stage 65 — 2026-09-14
- Convert the Delivery completion flow into an in-screen Today bottom sheet: it anchors to the lower edge, rises from below the viewport while Today retracts under the header, and dismisses back downward from the Cancel/X control or backdrop.

## Stage 67 — 2026-09-14
- Match the approved completion interaction: Today retracts upward beneath the header while a compact bottom sheet rises over the lower portion, keeping the route context visible behind it and reusing the existing modern completion controls.

## Stage 68 — 2026-09-14
- Refine the Delivery bottom sheet to match the supplied UI: centered blue handle, explicit completion title and destination, modern RouteHub controls, and a visible Cancel action that dismisses the sheet cleanly.

## Stage 69 — 2026-09-14
- Integrate the Delivery sheet directly into Today without a blurred backdrop; add handle drag-to-dismiss behavior while preserving the X/Cancel action and existing completion logic.

## Stage 70 — 2026-09-14
- Remove the scaled/retracted page gap behind the completion sheet so the map and active route card remain a continuous Today surface beneath the integrated panel.
