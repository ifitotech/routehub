# RouteHub Handoff

## Current State
`/driver` rewrites to Driver V3. Manager web is the active Grok zone after founder authorization on 2026-08-30.

## Last Work Completed
Manager simulation pass: typecheck the operations map hub coordinate, keep Florida address filters in tests, wrap Team / Invitations / More in ManagerShell so they match Today.

## Files Changed
- `app/operations-map.tsx`
- `tests/maps-provider.test.mjs`
- `app/manager/team/page.tsx`
- `app/manager/invitations/page.tsx`
- `app/manager/more/page.tsx`

## Validation
- `npm run typecheck`: pass
- `npm test`: 115/116 pass (remaining fail is Driver Apple Maps URL expectation, not Manager)

## Current Task
Manager web: map lines, truck add/edit, Today layout.

## Next Step
Physical QA of Manager Today map lines and Truck add/edit after Vercel deploy.

## Known Problems
- Live GPS / ETA still planned OSRM only until native Google Maps.
- Web PWA cannot track the truck with the app closed.

## Do Not Touch
Schema, RLS, Storage, Auth, Push/VAPID, service worker, GPS architecture, Driver V2 source, unless founder authorizes.
