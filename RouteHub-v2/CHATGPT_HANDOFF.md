# RouteHub — handoff
Updated: 2 Sep 2026 17:15 EDT. Grok verified live Geocoding.

Paste this file first. Do not invent a different architecture. Do not reopen the old Driver 97k split.

## Product
- Repo: `ifitotech/routehub` branch `main`
- Live: https://routehub-wisu.vercel.app
- Official Driver URL: `/driver` (middleware rewrite → `app/driver-v3`)
- App code: `RouteHub-v2/`
- Founder PC git root: `C:\\Users\\rodol\\Documents\\RouteHub`
- Ignore nested `RouteHub-v2\\RouteHub-v2\\`
- Push only when the founder authorizes

## HEAD as of this note
- `c29c180` Allow geocode fallback in maps provider tests
- `38dde7a` Fall back to Census and Nominatim when Google Geocoding is empty
- `ae1c554` Restore Census and Nominatim endpoints in map-config
- `7d9b4e10` Fix operations map address geocoding (`Number(null)` → Null Island)

## What we were fixing today (Manager operations map)
The map counted assigned routes but only placed one point, so it could not draw the full line.

1. Missing `nearLat` became `Number(null) === 0` and every Florida result was rejected as too far from 0,0. Fixed in `7d9b4e10` (`optionalCoordinateNumber`).
2. Google Routes worked; Google Geocoding returned empty (key/API restriction). Fallback added: Google → Census → Nominatim.
3. Founder confirmed Vercel env has `GOOGLE_MAPS_SERVER_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`. Code reads server key first (`lib/maps/map-config.ts`).

## Live check 2 Sep 2026 17:14 EDT
`GET https://routehub-wisu.vercel.app/api/geocode?address=100%20SE%202nd%20St,%20Miami,%20FL`

```
{"coordinate":{"lat":25.7720848,"lng":-80.1912988},"label":"Miami Tower, 100 SE 2nd St, Miami, FL 33131, USA","source":"google"}
```

Same result with `nearLat=25.77&nearLng=-80.19`. **Google Geocoding is live.** Earlier today the same URL returned `source: census`.

Do not treat Geocoding as broken unless a new probe returns `coordinate: null` or `source` is not `google` for a real street address.

## Env (names only — never commit key values)
Vercel project `routehub-wisu`:
- `GOOGLE_MAPS_SERVER_KEY` — `/api/geocode` and Routes. Must allow Geocoding API + Routes API. No HTTP-referrer restriction on this key.
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` — browser only. Code does not use this name for server geocode.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Still open (not a regression)
- Vague queries like `ab` become `ab, FL, USA` via `withFloridaQuery` and can resolve to the Florida centroid. Street addresses are fine.
- Manager Today still only persisted missing **destination** coords on `main`. A local unpushed draft also repairs origins/branch; do not push unless the founder asks.
- After Google started working, reload Manager Today so existing routes geocode and the polyline can use more than one point.
- Do not replace Driver V3 with the workspace 97k V2 split. `/driver` stays V3.

## Do not
- Invent ETA or fake GPS
- Touch schema, RLS, Auth, migrations unless the founder asks
- Restore old `route-plan-map.tsx` through the file connector
- Disable the Census/Nominatim fallback (keep it behind Google)
