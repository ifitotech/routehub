import test from 'node:test'
import assert from 'node:assert/strict'
import {clusterCoordinates,sanitizeCoordinate} from '../lib/maps/coordinates.ts'

test('sanitizeCoordinate swaps inverted Florida points and drops null-island',()=>{
  assert.deepEqual(sanitizeCoordinate({lat:-80.1918,lng:25.7617}),{lat:25.7617,lng:-80.1918})
  assert.deepEqual(sanitizeCoordinate({lat:25.7617,lng:-80.1918}),{lat:25.7617,lng:-80.1918})
  assert.equal(sanitizeCoordinate({lat:0,lng:0}),null)
  assert.equal(sanitizeCoordinate({lat:Number.NaN,lng:-80}),null)
  assert.equal(sanitizeCoordinate(null),null)
})

test('clusterCoordinates drops Atlantic outliers instead of fitting the whole ocean',()=>{
  const miami={lat:25.7617,lng:-80.1918}
  const swapped={lat:-80.1918,lng:25.7617}
  const atlantic={lat:0.2,lng:-30}
  const clustered=clusterCoordinates([miami,swapped,atlantic,null])
  assert.equal(clustered.length,1)
  assert.deepEqual(clustered[0],miami)
})
