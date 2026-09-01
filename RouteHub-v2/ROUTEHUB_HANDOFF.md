# RouteHub Handoff

## Current State
`/driver` is the official Driver V3 entry. Google Maps, Routes and Geocoding are the only map stack. GPS remains one visible-app browser watch during an active Driving Day.

## Last Work Completed
- Replaced Leaflet renderers in the shared live-route, route-plan and location-confirm maps with a shared Google Maps canvas.
- Google Routes now requests traffic-aware route duration, first-leg ETA, live traffic comparison and maneuver instructions.
- Address geocoding and explicit address suggestions now use Google only; manual entry remains available if lookup is unavailable.
- Driver position updates no longer re-fit or reset the map on each GPS fix.
- Internal navigation is a true full-screen map: no Driver header or bottom tabs, compact Exit/Arrived controls, traffic layer, next maneuver, maneuver distance, traffic-aware ETA, arrival time and an optional voice prompt.
- Pressing Arrived returns to the authoritative current stop and immediately opens the completion flow for Pickup, Delivery, or Return. Return now has its own confirmation sheet.
- Carry-over selection resumes the newest unfinished operational day first, so an older stale pending route cannot hide the current delivery.
- Added `lib/driver/driver-state.ts` as the shared persisted-state machine for pending, started, arrived, completed and issue phases plus the next operational action. Today now derives its started/arrived state through that layer.

## Files Changed
- `components/google-route-canvas.tsx`
- `app/api/routing/route.ts`
- `app/api/geocode/route.ts`
- `app/api/address-suggestions/route.ts`
- `app/live-route-map.tsx`
- `app/route-plan-map.tsx`
- `app/location-confirm-map.tsx`
- `lib/maps/*`
- `tests/maps-provider.test.mjs`
- `app/driver-v3/map/page.tsx`
- `app/driver-v3/page.tsx`
- `app/driver-route-navigation.tsx`
- `app/final-polish.css`

## Validation
- `git diff --check`: pass
- `npm run typecheck`: pass
- `npm test`: 118/118 pass
- `npm run build`: passes; existing unrelated CSS/lint warnings remain.

## Current Task
Continue consolidating Driver surfaces around the shared queue/state/action controller, then physically verify turn-by-turn navigation on a phone.

## Next Step
On a phone: start Driving Day, grant precise location, open `/driver/map`, verify moving driver pin, traffic overlay, next maneuver/distance, ETA, voice toggle, then press Arrived and confirm the correct completion sheet opens. Verify a pending delivery such as 985 W 28th St is selected ahead of older carry-over work.

## Known Problems
- Browser/PWA navigation cannot give continuous background GPS or native turn-by-turn audio after the app is closed; that requires a native wrapper and Google Navigation SDK.
- No known code blocker. Physical verification requires an active route and Google browser/server keys in Vercel.

## Do Not Touch
Schema, migrations, RLS, Storage, Auth, Push/VAPID, service worker, tenancy, route business rules, and Manager workflows without explicit authorization.
