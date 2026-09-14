# Handoff: Driver Today header/map "fusion" seam

**Status as of this handoff: still visually unresolved.** Multiple rounds of fixes have
shipped to production, each individually verified correct by some method, and the user
still sees a visible seam between the header and the map on the live app. This doc exists
so a fresh session (any agent, including ChatGPT/Codex with repo access) can pick this up
with full context instead of re-discovering everything from scratch, and - just as
important - can use the same verification discipline that finally started finding real
bugs here, instead of guessing from reading CSS.

## The ask, in the user's own words (paraphrased across many messages)

The Driver "Today" screen (`app/driver-v3/page.tsx`) has a real MapLibre map at the top of
the card, directly under the app's top header bar. The user wants the header and the map to
read as **one continuous surface** - "like they're the same thing," not a map sitting in a
box under a separate chrome bar. Reference language used repeatedly: "efecto de degradado
para unirlas" (gradient effect to join them), "que se fusionen," "no luce como si fueran
una" (doesn't look like they're one thing). The user has sent 6+ screenshots over this
thread, each still showing a visible horizontal boundary/line between the header and the
map.

**Scope note**: the user does NOT want the header itself to change color/gradient (this was
tried at Stage 30, explicitly rejected and reverted at Stage 34 - "quítalo, no es lo que me
referia"). The fusion has to happen on the map's side of the boundary, or via true visual
overlap, not by painting the header a different color.

## Tech stack / where things live

- Next.js 14 + React 18.3 + TypeScript, deployed on Vercel (`routehub-wisu` project, **not**
  `routehub-seven`). Repo `ifitotech/routehub`, work happens in the `RouteHub-v2/` folder.
- The Driver app lives in `app/driver-v3/`. The screen in question is
  `app/driver-v3/page.tsx` + `app/driver-v3/today.module.css`.
- Shared shell (header, bottom nav, content wrapper) is
  `components/driver-v3/DriverV3Shell.tsx`, styled by TWO merged CSS Modules:
  `components/driver-v3/driver-v3-a.module.css` and `driver-v3-b.module.css`, combined as
  `const styles = {...shellA, ...shellB}`. **This merge pattern is itself a landmine** - see
  "Real bug #1" below before touching either file.
- The map is `components/driver-v3/DriverRouteMap.tsx` /
  `DriverRouteMap.module.css` - a MapLibre GL JS map (`maplibre-gl` npm package v6, ESM-only,
  `import * as maplibregl from 'maplibre-gl'`), non-interactive, OpenStreetMap raster tiles,
  no API key, dark-tinted via a CSS `filter` on the canvas element (see "Known-good
  established techniques" below - do not re-derive this from scratch, it's already tuned).
- Theme tokens (`--rh-*` custom properties, dark-by-default with a light variant) live in
  `app/driver-v3/driver-theme-tokens.css`, scoped to `.driver-v3-root`.
- `CHANGELOG.md` (repo root) has a full, numbered stage-by-stage history of this exact
  screen's redesign - **Stages 17 through 44 are all this same Today/map effort**, including
  every attempt described below with more detail than this doc repeats. Read it before
  starting; it's the actual paper trail.

## Full timeline of attempts on this specific seam (all shipped, all in CHANGELOG.md)

1. **Stage 19**: real dark-tile MapLibre map built and color-verified with a Playwright
   render (see methodology below) - this part works and looks right.
2. **Stage 20**: bottom fade of the map (into the card below it) - linear, not radial. Works.
3. **Stage 27→28→29**: the *card* around the whole hero (map + text + button) read as its
   own box against the app background - not the header seam, a related-but-different bug.
   Root cause: the shared `.content` wrapper (driver-v3-a.module.css) has its own flat
   background + padding that showed through as a frame. Fixed at Stage 29 via the
   already-existing `flush` prop on `DriverV3Shell` (removes `.content`'s padding entirely).
   This part is solid and not what's currently broken.
4. **Stage 30**: gave the header itself the page's own gradient background, scoped via a
   `data-active='today'` attribute. **User explicitly rejected this** - reverted at Stage 34.
5. **Stage 33**: consolidated the gradient painting from 4 separate elements (header,
   content, page, map) down to one (`.content`), reasoning that 4 independent copies of the
   same CSS gradient put the radial highlight in 4 different spots (real, correct diagnosis
   of a real problem, but for the *content/page/map* seam, not the header one).
6. **Stage 34**: reverted the header-gradient part of Stage 30/33 per the user's explicit
   rejection. `.content[data-active='today']` (note this exact identifier - important later)
   kept painting the gradient for content+page+map to share.
7. **Stage 36**: tried a `.host::before` pseudo-element overlay on the map, fading from the
   header's flat color to transparent, to bridge the boundary. Seemed reasonable from reading
   the CSS.
8. **Stage 38-39**: iterated the overlay's height/gradient stops multiple times chasing user
   feedback that it still looked like "a second flat bar," not a blend.
9. **Stage 40**: added a real blue-to-teal `line-gradient` on the route line (a separate,
   successfully-resolved sub-issue - not the seam).
10. **Stage 42**: **first real verification breakthrough.** Instead of iterating on the CSS
    source again, built a throwaway static-HTML harness reproducing the exact compiled CSS
    and rendered it with Playwright (chromium, already cached locally from Stage 19's earlier
    work) - actually looking at pixels instead of reasoning about cascading CSS blind. Found
    two real, previously-invisible bugs this way:
    - `.host::before`'s overlay was being silently killed by `.host`'s own `mask-image`,
      which applies to a pseudo-element too, not just the element's background.
    - Empty/rural map tiles render near-black after the dark-tile filter chain (not just a
      different hue from the header - meaningfully darker), which a short fade can't bridge.
    - Fix: moved the overlay to a real sibling `<div>` (`.headerFade`), taller, multi-stop
      gradient. **This still did not resolve it from the user's perspective** in the next
      round of screenshots (see Stage 43).
11. **Stage 43**: the user asked explicitly for a different mechanism entirely - not a color
    match at the boundary, but making the map's own box physically extend up **behind** the
    header (true occlusion, not blending). Implemented via a CSS custom property
    `--map-bleed` (130px): `.page` (today.module.css) extends its own box up past its normal
    top edge with matching extra top padding (so nothing else shifts), the map
    (`.routeGlyphHost`/`Compact`) reaches into that head-room via a bigger negative margin,
    `.content[data-active='today']` switched from `overflow:hidden` to `overflow:visible` so
    the bleed isn't clipped, and `DriverRouteMap.module.css`'s `.host` (the actual MapLibre
    container) was changed to sit pinned to the *bottom* of a taller wrapper at its *original*
    size (so MapLibre's own resize/fitBounds math is unaffected). **Verified geometrically
    correct with a second Playwright harness pass**, including test markers confirming a
    marker at the map's own top pixel is visible exactly at the header/map boundary and one
    above that is fully hidden behind the header. Shipped. **Still did not resolve it visually
    in production** per the next screenshot.
12. **Stage 44**: dug into the actual *compiled* Next.js build output (not just source)
    instead of iterating on source a third time, and found the real bug (see "Real bug #1"
    below): `driver-v3-b.module.css`'s `.content[data-active='today']` selector had been
    silently generating its OWN "content" export, colliding with
    `driver-v3-a.module.css`'s "content" export in the `{...shellA, ...shellB}` merge -
    meaning the base `.content` rule (scroll behavior, width, padding, defined in
    `driver-v3-a.module.css`) had never actually been reaching the DOM, on any Driver screen,
    the entire time this whole thread has been going. Renamed to `.contentToday`, applied
    conditionally from JS instead of via the attribute selector, verified directly in the
    compiled build output that the collision is gone. **This still did not visually resolve
    the seam** per the screenshot that triggered this handoff doc.

## Real bug #1 (confirmed, fixed at Stage 44, but seam persists anyway - important signal)

CSS Modules hashes **every** class token it finds in a selector, including ones inside a
compound/attribute-qualified selector like `.content[data-active='today']` - not just a bare
`.content{}` rule. Two files (`driver-v3-a.module.css` and `driver-v3-b.module.css`) both had
a rule using the identifier `content`; their default exports get merged as
`{...shellA, ...shellB}` in `DriverV3Shell.tsx`, and a later spread key always wins a name
collision. This was found by grepping the actual compiled `.next/server/app/driver-v3/*/page.js`
output for the literal string `content:"` and seeing which hash won - **do this again** if
debugging anything that touches the merged `styles` object in `DriverV3Shell.tsx`, don't
trust the source files alone. Two more identifiers (`tag`, `stickyAction`) have the exact
same collision shape and are flagged but not fixed (neither is currently wired through the
merged object, so neither has a live bug today - grep before assuming that's still true).

**The important signal for whoever picks this up**: fixing a confirmed, real, verified-in-
compiled-output bug still did not resolve the reported visual symptom. That means either (a)
there is at least one more bug of a similarly invisible-from-source-reading shape still
active, or (b) the fixes have been landing correctly and the *actual* live visual state is
now different/better than the user's report suggests (screenshot staleness, CDN/build cache,
a device rendering quirk, etc.) and needs to be re-confirmed against a fresh, guaranteed-
post-deploy screenshot before writing any more CSS.

## Methodology already established and working - use it, don't skip it

This is the "work like you're doing" part of the ask - the discipline that actually found
real bugs (Stages 19, 42, 43, 44), as opposed to the discipline that shipped plausible-but-
ineffective fixes (Stages 30-40).

1. **Never ship a visual/CSS fix based on reading the source alone.** Every fix that was
   *reasoned* correct from the CSS but not *rendered* either did nothing (Stage 36-39, killed
   by an interaction with `.host`'s mask) or turned out to be standing on an unreachable base
   rule (Stage 44). Before shipping a CSS change to this screen, render it and look:
   - A throwaway static HTML file reproducing the *exact* compiled selectors/values (copy
     them, don't paraphrase) + a scratch `npm install playwright --no-save` in a **scratch
     directory outside the repo** (this session used the harness's own `AppData/Local/Temp`
     scratch dir) + a tiny Node script that launches chromium, screenshots, and exits.
     Chromium is likely already cached locally at `%LOCALAPPDATA%\ms-playwright\` from prior
     sessions - check before re-downloading.
   - For anything involving the actual `DriverRouteMap` component with real map tiles/route
     data, this static-mockup approach can't fully substitute for the real thing - strongly
     consider getting an actual screenshot of the deployed page (ask the user, or if you have
     any way to drive a real browser against the deployed/local app with real Supabase data).
   - **Delete the scratch harness completely** after verifying - nothing from it should ever
     be committed to the repo.
2. **When a fix doesn't work after shipping, check the *compiled* output, not just the
   source.** `npm run build` first, then grep `.next/server/app/driver-v3/**/page.js` for the
   literal class-name strings/keys you expect (e.g. `grep -o 'content:"[^"]*"'`). This is how
   Stage 44's bug was found - the source *looked* fine; the compiled JS proved it wasn't.
3. **Full validation before considering anything done**, every single time:
   `npm run typecheck`, `npm run build`, `npm test` (must be 149/149 passing - this is the
   correct current baseline), `npm run lint` (must show no *new* warnings beyond the existing
   baseline - there is a known, accepted set of pre-existing warnings, mostly
   `@next/next/no-img-element` and a handful of `react-hooks/exhaustive-deps` in files
   unrelated to this screen; don't try to fix those, just don't add to them).
4. **`CHANGELOG.md`** gets a new `### Stage N — <title>` entry for every change, continuing
   the existing numbering (currently at Stage 44), in the same style/detail level as the
   existing entries - explain *why*, including what was tried before and why it didn't work,
   not just what changed.
5. **Push directly to `main`** after validation passes (this is a standing, explicit
   instruction from the user for this whole project - no preview branches, no PRs held for
   review) and **poll the deploy status** before reporting back:
   `SHA=$(git rev-parse HEAD)` then poll
   `gh api repos/ifitotech/routehub/commits/$SHA/status --jq .state` every ~8s until it's
   `success` (or `failure`/`error`) - do not tell the user something is live before this
   confirms it.
6. **Report back in Spanish**, concisely, stating plainly what was actually verified vs. what
   is still a hypothesis - this user has been very precise and has caught overclaiming before.
   Ask for a fresh screenshot to confirm rather than assuming a shipped fix worked.

## Known-good established techniques (do not re-derive, just reuse)

- Dark map tile recipe (`DriverRouteMap.module.css` `.canvas`):
  `filter: grayscale(1) invert(1) brightness(.92) contrast(1.05) sepia(.6) hue-rotate(190deg)
  saturate(2.6)` - grayscale first removes per-tile hue variance, then invert+sepia+hue-rotate
  re-tints uniformly. Verified empirically at Stage 19, works, do not change without
  re-verifying visually (empty/undetailed tiles render near-black through this filter - a
  real, confirmed fact used in later reasoning, see Stage 42).
- `flush` prop on `DriverV3Shell` removes `.content`'s own padding for a screen that wants to
  own its own full-bleed background - already used correctly by both Today and the Map
  screen, don't reinvent this.
- `--map-bleed` (currently `130px`, today.module.css `.page`) is the mechanism for extending
  an element's box up behind the sticky header while keeping every other child in its normal
  visual position (via matching negative margin-top + top padding on the parent, and a bigger
  compensating negative margin + extra height on the specific child that should reach up).
  This pattern is verified sound geometrically (Stage 43) and is likely reusable if a similar
  "extend under the header" need comes up elsewhere.

## Suggested first step for whoever picks this up

Before writing any more CSS: get (or ask the user for) a screenshot taken **fresh, after
confirming the Stage 44 deploy is the one being viewed** (hard refresh / clear cache if it's
a PWA-like mobile web view that might be showing a cached build). If the seam is still there
in a guaranteed-fresh screenshot, the next move is almost certainly to inspect **live
computed styles** via browser devtools on the actual deployed page (not a static mockup) -
specifically confirm, at the exact pixel row where the header ends: (a) which element is
actually painting there, (b) its actual resolved `background`/`overflow` values, and (c)
whether `.contentToday` (or whatever it's named by the time this is read) is actually present
in that element's class list at runtime. That would settle definitively whether this is yet
another silent build/export issue, or whether the geometry itself needs another look with
real data (real header height on the actual test device, real safe-area-inset-top, a real
MapLibre canvas instead of the flat-color mockup used in every Playwright harness so far).
