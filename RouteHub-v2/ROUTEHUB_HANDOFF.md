# RouteHub Handoff

## Current State
`/driver` remains the official Driver entry. Add Route now uses one canonical `{lat, lng}` contract across saved places, branch selections, preview maps, geocoding, and route publishing.

## Last Work Completed
Fixed the Add Route branch-coordinate bug that could draw a Florida branch in Africa. Inverted legacy Miami coordinates are corrected only when their inverse is a Florida location; other valid world coordinates remain unchanged. Return to branch persists the selected branch's real destination coordinates. Custom origin uses an available selected Driver GPS fix. Google route geometry is accepted only when it begins and ends near the submitted locations; otherwise the map falls back to those real locations.

## Files Changed
- `app/routes/page.tsx`
- `app/operations-map.tsx`
- `app/api/routing/route.ts`
- `lib/maps/coordinates.ts`
- `lib/maps/geocoding.ts`
- `lib/maps/routing.ts`
- `tests/coordinates.test.mjs`

## Validation
- `git diff --check`: pass
- `npm run typecheck`: pass
- `npm test`: 120/120 pass
- `npm run build`: pass (existing lint/CSS warnings only)

## Current Task
Verify Add Route with the branch `15451 NW 33rd Pl, 33054`: preview and published route must stay in Florida.

## Next Step
After deployment, create one Return to branch and one normal route from the branch, then confirm both marker and route line remain local.

## Known Problems
No known Add Route coordinate blocker.

## Do Not Touch
Schema, migrations, RLS, Storage, Auth, Push/VAPID, service worker, tenancy, Driver workflow, and unrelated uncommitted workspace files.
