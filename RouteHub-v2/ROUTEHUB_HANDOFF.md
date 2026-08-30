# RouteHub Handoff

## Current State
`/driver` rewrites to Driver V3; `/driver-v3` remains the code path. Driver V2 source stays intact as fallback.
Driver V3 uses four tabs: Today, Map, Truck, More; Today contains the route queue.
The manager Routes page now presents pending/active/scheduled work under **Pending Routes** and completed work under **Completed Routes**. Completed routes remain excluded from the pending, in-progress, upcoming, and planning-map collections.

## Last Work Completed
Clarified the existing route separation on the manager Routes page with distinct Pending Routes and Completed Routes headings and localized copy in English, Spanish, and French. The existing status filters were preserved so completed routes cannot appear in the operational groups.

## Files Changed
- `app/routes/page.tsx`
- `ROUTEHUB_HANDOFF.md`

## Validation
- `npm test`: 115/116 pass; one pre-existing Maps provider assertion fails because the implementation returns a `maps:` URL while the test expects `maps.apple.com`.
- `npm run typecheck`: pass
- `git diff --check`: pass

## Current Task
Validate the manager Routes grouping, then founder physical QA.

## Next Step
Confirm the Pending Routes and Completed Routes sections with real route data while preserving the current design.

## Known Problems
- `ROUTEHUB_MASTER_CONTEXT.md` is not present in the repository; work continued without creating it.
- The repository has no local `main` ref or configured remote; the checked-out `work` branch was clean at the start of this task.
- Driver Map header blur must be rechecked after the newest Vercel deployment/PWA refresh; source explicitly disables header blur.

## Do Not Touch
Manager features outside the Routes presentation change, Driver V2 source, schema, RLS, Storage, Auth, Push/VAPID, service worker, GPS architecture, tenancy, and route business rules.
