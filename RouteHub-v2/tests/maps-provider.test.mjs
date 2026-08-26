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

test('routing adapter preserves a non-blocking OSRM fallback contract',async()=>{
  const source=await readFile(new URL('../lib/maps/routing.ts',import.meta.url),'utf8')
  assert.match(source,/coordinates:coordinates\.length\?coordinates:fallback/)
  assert.match(source,/source:coordinates\.length\?'osrm':'fallback'/)
  assert.match(source,/if\(!response\.ok\)return fallback/)
  assert.match(source,/catch\{return fallback\}/)
})

test('geocoding adapter rejects incomplete queries and invalid coordinates',async()=>{
  const source=await readFile(new URL('../lib/maps/geocoding.ts',import.meta.url),'utf8')
  assert.match(source,/Number\.isFinite\(coordinate\.lat\)/)
  assert.match(source,/Number\.isFinite\(coordinate\.lng\)/)
  assert.match(source,/minimumSearchCharacters/)
  assert.match(source,/maximumSearchCharacters/)
})
