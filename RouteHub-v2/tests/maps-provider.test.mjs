import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {appleMapsNavigationUrl,googleMapsNavigationUrl,openNavigation} from '../lib/maps/external-navigation.ts'

test('navigation uses coordinates before a human-readable address',()=>{
  const destination={address:'Wrong address',coordinate:{lat:25.9,lng:-80.3},label:'RouteHub destination'}
  assert.match(googleMapsNavigationUrl(destination),/destination=25.9%2C-80.3/)
  assert.match(appleMapsNavigationUrl(destination),/daddr=25.9%2C-80.3/)
  assert.match(openNavigation(destination,'iPhone'),/maps\.apple\.com/)
})

test('driver next stop keeps progress visible and opens the in-app navigation map',async()=>{
  const source=await readFile(new URL('../app/driver/page.tsx',import.meta.url),'utf8')
  assert.match(source,/currentStopIndex\+1/)
  assert.match(source,/setRouteView\('map'\)/)
  assert.match(source,/RoutePlanMap/)
  assert.match(source,/routeFocusDate/)
  assert.match(source,/pastDue:routeFocusDate<today/)
})

test('driver navigation identifies unfinished overdue work as pending',async()=>{
  const source=await readFile(new URL('../app/route-plan-map.tsx',import.meta.url),'utf8')
  assert.match(source,/pastDue\?:boolean/)
  assert.match(source,/route-plan-overdue/)
  assert.match(source,/Past due · Pending/)
})

test('driver navigation sheet expands without stopping or remounting the map',async()=>{
  const source=await readFile(new URL('../app/route-plan-map.tsx',import.meta.url),'utf8')
  assert.match(source,/route-plan-sheet-handle/)
  assert.match(source,/onPointerMove=\{moveSheet\}/)
  assert.match(source,/setSheetExpanded\(true\)/)
  assert.match(source,/setSheetExpanded\(false\)/)
  assert.match(source,/activeStop\?\.orderNumber/)
})

test('GPS arrival requires a driver confirmation and next-stop routing rejects stale responses',async()=>{
  const map=await readFile(new URL('../app/route-plan-map.tsx',import.meta.url),'utf8')
  const driver=await readFile(new URL('../app/driver/page.tsx',import.meta.url),'utf8')
  assert.match(map,/setArrivalReady\(true\)/)
  assert.match(map,/detail:\{manual:true,distance:destinationDistance\}/)
  assert.match(map,/disabled=\{!nearDestination\|\|arrivalConfirmed\}/)
  assert.match(map,/navigationRequest\.current/)
  assert.match(map,/acceptedGpsFix\.current/)
  assert.match(driver,/if\(!detail\?\.manual\)/)
})

test('routing adapter preserves a non-blocking OSRM fallback contract',async()=>{
  const source=await readFile(new URL('../lib/maps/routing.ts',import.meta.url),'utf8')
  assert.match(source,/coordinates:coordinates\.length\?coordinates:fallback/)
  assert.match(source,/source:coordinates\.length\?'osrm':'fallback'/)
  assert.match(source,/if\(!response\.ok\)return fallback/)
  assert.match(source,/catch\{return fallback\}/)
  assert.match(source,/remainingRouteDistance/)
  assert.match(source,/distanceToManeuverMeters/)
  assert.match(source,/item\.index>=currentIndex/)
})

test('geocoding adapter rejects incomplete queries and invalid coordinates',async()=>{
  const source=await readFile(new URL('../lib/maps/geocoding.ts',import.meta.url),'utf8')
  assert.match(source,/Number\.isFinite\(coordinate\.lat\)/)
  assert.match(source,/Number\.isFinite\(coordinate\.lng\)/)
  assert.match(source,/minimumSearchCharacters/)
  assert.match(source,/maximumSearchCharacters/)
})

test('geocoding API routes use the centralized provider configuration',async()=>{
  const suggestions=await readFile(new URL('../app/api/address-suggestions/route.ts',import.meta.url),'utf8')
  const geocode=await readFile(new URL('../app/api/geocode/route.ts',import.meta.url),'utf8')
  assert.match(suggestions,/geocodingConfig\.censusEndpoint/)
  assert.match(suggestions,/geocodingConfig\.nominatimEndpoint/)
  assert.match(geocode,/geocodingConfig\.censusEndpoint/)
  assert.match(geocode,/geocodingConfig\.nominatimEndpoint/)
  assert.doesNotMatch(suggestions,/new URL\('https:\/\/geocoding\.geo\.census\.gov/)
  assert.doesNotMatch(geocode,/new URL\('https:\/\/nominatim\.openstreetmap\.org/)
})

test('address suggestions discard provider results without usable coordinates',async()=>{
  const source=await readFile(new URL('../app/api/address-suggestions/route.ts',import.meta.url),'utf8')
  assert.match(source,/\.filter\(candidate => validCoordinate\(candidate\.coordinate\)\)/)
})

test('route location storage has one canonical destination coordinate contract',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/033_normalize_route_location_columns.sql',import.meta.url),'utf8')
  const driver=await readFile(new URL('../app/driver/page.tsx',import.meta.url),'utf8')
  assert.match(migration,/destination_location_external_id/)
  assert.match(migration,/destination_lat = coalesce\(destination_lat, dest_lat\)/)
  assert.match(driver,/destination_lat,destination_lng/)
  assert.doesNotMatch(driver,/select\([^\n]*dest_lat,dest_lng/)
})
