# RouteHub Handoff

## Current State
`/driver` rewrites to Driver V3; `/driver-v3` remains the code path. Driver V2 source stays intact as fallback.
Driver V3 uses four tabs: Today, Map, Truck, More; Today contains the route queue.

## Last Work Completed
External Maps now uses same-window system handoff from Today, Map, and Stop Details. It no longer opens a secondary browser tab that can remain blank after returning from Maps. An arrived Return on Today now shows the green backend-confirmed Complete Return action instead of Continue Route.

## Files Changed
- `app/driver-v3/page.tsx`
- `app/driver-v3/map/page.tsx`
- `app/driver-v3/stop/page.tsx`

## Validation
- `npm test`: 116/116 pass
- `npm run typecheck`: pass
- `git diff --check`: pass

## Current Task
Founder physical QA of Driver V3.

## Next Step
Apply only founder-approved bug fixes while preserving Grok's V3 design.

## Known Problems
- Driver Map header blur must be rechecked after the newest Vercel deployment/PWA refresh; source explicitly disables header blur.

## Do Not Touch
Manager, Driver V2 source, schema, RLS, Storage, Auth, Push/VAPID, service worker, GPS architecture, tenancy, and route business rules.
