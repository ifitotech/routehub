# RouteHub handoff — 31 Aug 2026 19:37 EDT

Paste this to ChatGPT / Grok before working.

## Product
- Repo: `ifitotech/routehub` branch `main`
- App folder: `RouteHub-v2/`
- Live: https://routehub-wisu.vercel.app
- Official Driver URL: `/driver` (V3 is `app/driver-v3` via middleware rewrite — do not edit V3/Manager/schema/RLS unless founder asks)
- Founder PC git root: `C:\\Users\\rodol\\Documents\\RouteHub`
- Ignore untracked nested `RouteHub-v2\\RouteHub-v2\\`
- Local backup branch: `local-backup-2026-08-31`
- origin/main is source of truth. No reset/stash. Push only with founder permission.

## Where we stopped
Driver V2 map + GPS is on `main` and ready to **test on phone**.

Latest relevant commits:
- `f55d7c0` Restore working Driver map (compact Leaflet map, stored coords, shared GPS)
- `538490b` Adapter understands old LiveRouteMap props from `app/driver/page.tsx`
- `76ed958` Adapter also reads `waypoints` / `stops` so the full queue can draw

`app/driver/page.tsx` on GitHub still uses LiveRouteMap-style props:
`originAddress`, `destinationAddress`, `originCoordinate`, `destinationCoordinate`, `driverLocation`, `waypoints`.
The adapter maps those into `RoutePlanMap`. A line should show when origin + destination exist.

A newer page.tsx exists in the Grok workspace (`RouteHub-v2/app/driver/page.tsx`, ~97k) with:
- `afterStopCompleted` → reload, next pending, stay on map
- `openArrivalFlow` by kind (pickup / delivery / branch)
- idempotent `confirmPickup`
- clean `finishDrivingDay`
- `liveFix` + `waypoints={currentRouteStops}`
That file is not fully on GitHub (connector truncates ~90k files). Next agent should push it from founder PC after `git pull`, or split the patch.

## How GPS works now
- One `watchPosition` on Driver page while driving session is open
- Map uses `trackDevice={false}` + `sharedLocation` / `driverLocation`
- Pin only while `/driver` is visible (PWA cannot background-track)
- Use stored `origin_lat/lng` + `destination_lat/lng` first, else geocode

## What to test
1. Vercel Ready on latest main
2. Login `/driver`, start day, allow location
3. Today + Map: pin + blue line if origin+dest (or 2+ stops)
4. Llegué / pickup confirm / delivery recipient / branch
5. Google Maps only if tapped
6. End driving day must not crash

## Do not
- Touch V3, Manager, schema, RLS
- Commit `tsconfig.tsbuildinfo`, pngs, `.codex-remote-attachments`, `supabase/.temp`, nested RouteHub-v2 copy
- Restore the 28k old `route-plan-map.tsx` via GitHub connector (it gets truncated to `return null`)
- Invent ETA / fake data

## Next code work (after a successful field test)
1. Push workspace `page.tsx` (afterStopCompleted + arrival flows) to main
2. Map sheet: internal Arrive primary, Google secondary
3. Optionally restore rich maneuver/voice UI without deleting the compact working map
4. Native wrapper later for always-on GPS
