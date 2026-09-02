import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {appleMapsNavigationUrl,googleMapsNavigationUrl,openNavigation} from '../lib/maps/external-navigation.ts'
import {selectDriverTodayQueue} from '../lib/driver-queue.ts'

test('navigation uses coordinates before a human-readable address',()=>{
  const destination={address:'Wrong address',coordinate:{lat:25.9,lng:-80.3},label:'RouteHub destination'}
  assert.match(googleMapsNavigationUrl(destination),/destination=25.9%2C-80.3/)
  assert.match(appleMapsNavigationUrl(destination),/daddr=25.9%2C-80.3/)
  assert.match(openNavigation(destination,'iPhone'),/^maps:\/\//)
  assert.match(openNavigation(destination,'Android'),/^google\.navigation:/)
})

test('Driver entry uses the V3 current operation, quota-safe preview, and real external navigation',async()=>{
  const entry=await readFile(new URL('../app/driver/page.tsx',import.meta.url),'utf8')
  const source=await readFile(new URL('../app/driver-v3/page.tsx',import.meta.url),'utf8')
  assert.match(entry,/driver-v3\/page/)
  assert.match(source,/snapshot\?\.currentOperation/)
  assert.match(source,/OpenStreetRoutePreview/)
  assert.match(source,/router\.prefetch\('\/driver\/map'\)/)
  assert.match(source,/openNavigation\(/)
  assert.match(source,/route\.destination_lat/)
  assert.doesNotMatch(source,/autoStartNavigation/)
})

test('driver queue identifies unfinished work from the authoritative operational date',()=>{
  const routes=[
    {id:'yesterday',driver_id:'driver',route_date:'2026-08-29',status:'published',position:1},
    {id:'today',driver_id:'driver',route_date:'2026-08-30',status:'published',position:1},
    {id:'done',driver_id:'driver',route_date:'2026-08-30',status:'completed',position:2},
  ]
  const queue=selectDriverTodayQueue(routes,'driver','2026-08-30')
  assert.equal(queue.current?.id,'yesterday')
  assert.deepEqual(queue.upcoming.map(route=>route.id),['today'])
})

test('Driver V3 map keeps the live map mounted while actions return to Today',async()=>{
  const source=await readFile(new URL('../app/driver-v3/map/page.tsx',import.meta.url),'utf8')
  assert.match(source,/dynamic\(\(\) => import\('\.\.\/\.\.\/driver-route-navigation'\)/)
  assert.match(source,/sharedLocation=\{gps\}/)
  assert.match(source,/onExit=\{\(\) => router\.push\('\/driver'\)\}/)
  assert.match(source,/router\.push\('\/driver'\)/)
})

test('Arrival is an explicit V3 action and refreshes the authoritative operation',async()=>{
  const source=await readFile(new URL('../app/driver-v3/page.tsx',import.meta.url),'utf8')
  const map=await readFile(new URL('../app/driver-v3/map/page.tsx',import.meta.url),'utf8')
  assert.match(source,/markArrived\(ctx\(\)\)/)
  assert.match(source,/await refresh\(\)/)
  assert.match(map,/markArrived\(\{routeId: route\.id, driverId, companyId: route\.company_id\}\)/)
  assert.match(map,/disabled=\{busy\}/)
})

test('navigation exit and arrival return to the Driver workflow instead of restarting the map',async()=>{
  const map=await readFile(new URL('../app/driver-v3/map/page.tsx',import.meta.url),'utf8')
  assert.match(map,/onExit=\{\(\) => router\.push\('\/driver'\)\}/)
  assert.match(map,/router\.push\('\/driver'\)/)
  assert.doesNotMatch(map,/autoStartNavigation/)
})

test('Driver V3 GPS uses a fresh high-accuracy watch and persists accepted fixes',async()=>{
  const gps=await readFile(new URL('../lib/driver-v3/use-driver-live-location.ts',import.meta.url),'utf8')
  assert.match(gps,/enableHighAccuracy: true/)
  assert.match(gps,/maximumAge: 0/)
  assert.match(gps,/timeout: 20000/)
  assert.match(gps,/materiallyMorePrecise/)
  assert.match(gps,/next\.accuracy \+ 15 < previous\.accuracy/)
  assert.match(gps,/updateDrivingLocation\(drivingSession\.id, driverId, next\)/)
  assert.match(gps,/setLiveFix\(\{lat: next\.lat, lng: next\.lng/)
})

test('routing adapter uses the Google Routes API with a safe coordinate-only fallback',async()=>{
  const source=await readFile(new URL('../lib/maps/routing.ts',import.meta.url),'utf8')
  const api=await readFile(new URL('../app/api/routing/route.ts',import.meta.url),'utf8')
  assert.match(source,/coordinates:points,source:'fallback'/)
  assert.match(source,/if\(!response\.ok\)return fallback/)
  assert.match(source,/catch\{return fallback\}/)
  assert.match(source,/remainingRouteDistance/)
  assert.match(source,/distanceToManeuverMeters/)
  assert.match(source,/item\.index>=currentIndex/)
  assert.doesNotMatch(source,/project-osrm|normalizeOsrmRoute|routeRequestUrl/)
  assert.match(api,/trafficAware=Boolean\(payload\.trafficAware\)/)
  assert.match(api,/routingPreference:trafficAware\?'TRAFFIC_AWARE':'TRAFFIC_UNAWARE'/)
  assert.match(api,/routes\.staticDuration/)
  assert.match(api,/routes\.legs\.steps\.navigationInstruction\.instructions/)
  assert.match(api,/function isCompatibleRoute/)
  assert.match(api,/const routeCoordinates=isCompatibleRoute\(decoded,points\)\?decoded:points/)
  assert.match(source,/function geometryMatchesEndpoints/)
})

test('geocoding adapter rejects incomplete queries and invalid coordinates',async()=>{
  const source=await readFile(new URL('../lib/maps/geocoding.ts',import.meta.url),'utf8')
  assert.match(source,/Number\.isFinite\(coordinate\.lat\)/)
  assert.match(source,/Number\.isFinite\(coordinate\.lng\)/)
  assert.match(source,/minimumSearchCharacters/)
  assert.match(source,/maximumSearchCharacters/)
})

test('address lookup uses Google as the single centralized provider',async()=>{
  const suggestions=await readFile(new URL('../app/api/address-suggestions/route.ts',import.meta.url),'utf8')
  const geocode=await readFile(new URL('../app/api/geocode/route.ts',import.meta.url),'utf8')
  assert.match(suggestions,/geocodingConfig\.googleGeocodeEndpoint/)
  assert.match(suggestions,/geocodingConfig\.googleKey/)
  assert.match(geocode,/geocodingConfig\.googleGeocodeEndpoint/)
  assert.match(geocode,/geocodingConfig\.googleKey/)
  assert.doesNotMatch(suggestions,/censusEndpoint|nominatimEndpoint|openstreetmap/)
  assert.doesNotMatch(geocode,/censusEndpoint|nominatimEndpoint|openstreetmap/)
})

test('address suggestions discard provider results without usable coordinates',async()=>{
  const source=await readFile(new URL('../app/api/address-suggestions/route.ts',import.meta.url),'utf8')
  assert.match(source,/\.filter\(candidate => validCoordinate\(candidate\.coordinate\) && isInFlorida\(candidate\.coordinate/)
})

test('route location storage has one canonical destination coordinate contract',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/033_normalize_route_location_columns.sql',import.meta.url),'utf8')
  const driver=await readFile(new URL('../lib/driver-v3/use-driver-data.ts',import.meta.url),'utf8')
  assert.match(migration,/destination_location_external_id/)
  assert.match(migration,/destination_lat = coalesce\(destination_lat, dest_lat\)/)
  assert.match(driver,/destination_lat,destination_lng/)
  assert.doesNotMatch(driver,/select\([^\n]*dest_lat,dest_lng/)
})
