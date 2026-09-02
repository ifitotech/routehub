import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {androidNavigationUrls,appleMapsNavigationUrl,googleMapsNavigationUrl,openNavigation,openNavigationWithFallback} from '../lib/maps/external-navigation.ts'
import {selectDriverTodayQueue} from '../lib/driver-queue.ts'
import {buildOperationsSequence} from '../lib/maps/operations-sequence.ts'
import {optionalCoordinateNumber} from '../lib/maps/map-config.ts'

test('navigation uses coordinates before a human-readable address',()=>{
  const destination={address:'Wrong address',coordinate:{lat:25.9,lng:-80.3},label:'RouteHub destination'}
  assert.match(googleMapsNavigationUrl(destination),/destination=25.9%2C-80.3/)
  assert.match(appleMapsNavigationUrl(destination),/daddr=25.9%2C-80.3/)
  assert.match(openNavigation(destination,'iPhone'),/^maps:\/\//)
  assert.match(openNavigation(destination,'Android'),/^google\.navigation:/)
  assert.deepEqual(androidNavigationUrls(destination).map(url=>url.split(':')[0]),['google.navigation','geo','https'])
})

test('android external navigation keeps a native fallback chain while non-browser platforms stay direct',()=>{
  const destination={coordinate:{lat:25.9,lng:-80.3}}
  assert.equal(openNavigationWithFallback(destination),false)
  assert.match(openNavigation(destination,'Android 14; Pixel'),/^google\.navigation:/)
  assert.match(openNavigation(destination,'iPhone OS 18_0'),/^maps:\/\//)
})

test('Driver entry uses the V3 current operation, quota-safe preview, and real external navigation',async()=>{
  const entry=await readFile(new URL('../app/driver/page.tsx',import.meta.url),'utf8')
  const source=await readFile(new URL('../app/driver-v3/page.tsx',import.meta.url),'utf8')
  assert.match(entry,/driver-v3\/page/)
  assert.match(source,/snapshot\?\.currentOperation/)
  assert.match(source,/OpenStreetRoutePreview/)
  assert.match(source,/router\.prefetch\('\/driver\/map'\)/)
  assert.match(source,/openNavigationWithFallback\(/)
  assert.match(source,/sheet==='next'/)
  assert.match(source,/setSheet\('next'\)/)
  assert.match(source,/router\.push\('\/driver\/history'\)/)
  assert.match(source,/target\.destination_lat!=null&&target\.destination_lng!=null/)
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

test('operations preview keeps the stored starting point and connects the authoritative queue',()=>{
  const branch={lat:25.9017,lng:-80.3078}
  const driver={lat:25.925,lng:-80.29}
  const first={lat:25.94,lng:-80.25}
  const second={lat:25.88,lng:-80.20}
  const sequence=buildOperationsSequence([
    {id:'active',position:1,status:'active',origin:branch,destination:first},
    {id:'next',position:2,status:'published',origin:branch,destination:second},
  ],driver)
  assert.deepEqual(sequence.points,[branch,first,second])
  assert.deepEqual(sequence.start,branch)
})

test('operations preview repairs a one-point legacy route with the live Driver start',()=>{
  const driver={lat:25.925,lng:-80.29}
  const destination={lat:25.9017,lng:-80.3078}
  const sequence=buildOperationsSequence([
    {id:'return',position:1,status:'published',origin:destination,destination},
  ],driver)
  assert.deepEqual(sequence.points,[driver,destination])
})

test('operations map keeps completed and issue stops in the full assigned route',()=>{
  const branch={lat:25.9017,lng:-80.3078}
  const completed={lat:25.92,lng:-80.28}
  const issue={lat:25.94,lng:-80.25}
  const pending={lat:25.88,lng:-80.20}
  const sequence=buildOperationsSequence([
    {id:'done',position:1,status:'completed',origin:branch,destination:completed},
    {id:'problem',position:2,status:'issue',origin:completed,destination:issue},
    {id:'next',position:3,status:'published',origin:issue,destination:pending},
  ])
  assert.deepEqual(sequence.points,[branch,completed,issue,pending])
})

test('geocoding adapter rejects incomplete queries and invalid coordinates',async()=>{
  const source=await readFile(new URL('../lib/maps/geocoding.ts',import.meta.url),'utf8')
  assert.match(source,/Number\.isFinite\(coordinate\.lat\)/)
  assert.match(source,/Number\.isFinite\(coordinate\.lng\)/)
  assert.match(source,/minimumSearchCharacters/)
  assert.match(source,/maximumSearchCharacters/)
})

test('address lookup uses Google first and keeps open geocoding fallback',async()=>{
  const suggestions=await readFile(new URL('../app/api/address-suggestions/route.ts',import.meta.url),'utf8')
  const geocode=await readFile(new URL('../app/api/geocode/route.ts',import.meta.url),'utf8')
  assert.match(suggestions,/geocodingConfig\.googleGeocodeEndpoint/)
  assert.match(suggestions,/geocodingConfig\.googleKey/)
  assert.match(geocode,/geocodingConfig\.googleGeocodeEndpoint/)
  assert.match(geocode,/geocodingConfig\.googleKey/)
  assert.match(geocode,/geocodingConfig\.censusEndpoint/)
  assert.match(geocode,/geocodingConfig\.nominatimEndpoint/)
  assert.match(geocode,/source:'google'\|'census'\|'nominatim'/)
  assert.doesNotMatch(suggestions,/censusEndpoint|nominatimEndpoint|openstreetmap/)
})

test('geocode route still prefers Google before Census or Nominatim',async()=>{
  const geocode=await readFile(new URL('../app/api/geocode/route.ts',import.meta.url),'utf8')
  const googleAt=geocode.indexOf('googleGeocodeEndpoint')
  const censusAt=geocode.indexOf('censusEndpoint')
  const nominatimAt=geocode.indexOf('nominatimEndpoint')
  assert.ok(googleAt>0 && censusAt>googleAt && nominatimAt>censusAt)
})

test('geocoding does not turn an omitted nearby coordinate into null island',()=>{
  assert.equal(optionalCoordinateNumber(null),null)
  assert.equal(optionalCoordinateNumber(''),null)
  assert.equal(optionalCoordinateNumber('not-a-coordinate'),null)
  assert.equal(optionalCoordinateNumber('25.9017'),25.9017)
  assert.equal(optionalCoordinateNumber('-80.3078'),-80.3078)
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
