import test from 'node:test'
import assert from 'node:assert/strict'
import {distanceFromNavigationPath,usableNavigationFix} from '../lib/maps/navigation-progress.ts'

test('a driver midway along a sparse road is on route, not far from a vertex',()=>{
  const line=[{lat:25,lng:-80},{lat:25,lng:-79.98}]
  assert.ok(distanceFromNavigationPath({lat:25,lng:-79.99},line)<1)
  assert.ok(distanceFromNavigationPath({lat:25.002,lng:-79.99},line)>200)
})
test('distance projection stays within segment endpoints and handles repeated points',()=>{
  const point={lat:25,lng:-80}
  assert.equal(distanceFromNavigationPath(point,[point,point]),0)
  assert.ok(distanceFromNavigationPath({lat:25,lng:-80.01},[point,{lat:25,lng:-79.99}])>900)
  assert.equal(distanceFromNavigationPath(point,[]),Infinity)
})
test('stale, invalid and inaccurate GPS cannot trigger navigation reroutes',()=>{
  const now=100000
  assert.equal(usableNavigationFix({accuracy:10,updatedAt:now-1000},now),true)
  for(const fix of [null,{accuracy:100,updatedAt:now},{accuracy:10,updatedAt:now-31000},{accuracy:NaN,updatedAt:now},{accuracy:10,updatedAt:NaN}]){
    assert.equal(usableNavigationFix(fix,now),false)
  }
})
