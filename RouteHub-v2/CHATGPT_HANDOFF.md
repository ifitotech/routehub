# RouteHub — handoff for ChatGPT review
Updated: 31 Aug 2026 20:19 EDT. Pushed map + adapter + coordinates + tests. page.tsx may follow in a second commit.

Paste this file first. Then read the files listed below. Do not invent a different architecture.

## Product and rules
- Repo: `ifitotech/routehub` branch `main`
- Live: https://routehub-wisu.vercel.app
- Official Driver URL: `/driver`
- App code: `RouteHub-v2/`
- Founder PC git root: `C:\\Users\\rodol\\Documents\\RouteHub`
- Nested junk: ignore `RouteHub-v2\\RouteHub-v2\\`
- Local backup branch: `local-backup-2026-08-31`
- **Do not edit** Manager, Driver V3, schema, RLS, Auth, migrations
- **Do not** invent ETA or fake GPS
- **Do not** restore the old 28k `route-plan-map.tsx` via the GitHub file connector
- Push only when the founder authorizes

## What landed on GitHub in this push
- `app/driver-route-navigation.tsx` — full stop queue, GPS origin, activeStopId, sanitized coords, trackDevice=false
- `app/route-plan-map.tsx` — compact Leaflet, polyline, sharedLocation, cluster fitBounds, cleanup
- `app/live-route-map.tsx` — same coordinate sanitization on Today map
- `lib/maps/coordinates.ts` — swap inverted lat/lng, drop (0,0), cluster ~800km
- `tests/coordinates.test.mjs`
- `tests/maps-provider.test.mjs`
- this handoff

## page.tsx note
Workspace `app/driver/page.tsx` (~97k) already passes `stops={currentRouteStops}`, `activeStopId`, `markArrived` + `openArrivalFlow`, `afterStopCompleted`, Continuar navegación, Google as `mapSecondaryAction`. If that file is still the older GitHub version after this commit, copy it from the Grok workspace or founder PC after pull — do not commit tsconfig.tsbuildinfo / nested copies.

## Review checklist
1. page passes full `currentRouteStops`
2. Ya llegué opens pickup/delivery/branch flow
3. After complete, stay on map
4. One GPS watch only
5. Inverted coords cannot zoom to the Atlantic
6. Google is secondary
