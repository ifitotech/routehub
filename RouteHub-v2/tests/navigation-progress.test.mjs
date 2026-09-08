import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {distanceFromNavigationPath,usableNavigationFix,projectNavigationPosition,splitNavigationPath,navigationManeuver,navigationRemainingSeconds,interpolateHeading} from '../lib/maps/navigation-progress.ts'

test('a driver midway along a sparse road is on route, not far from a vertex',()=>{
  const line=[{lat:25,lng:-80},{lat:25,lng:-79.98}]
  assert.ok(distanceFromNavigationPath({lat:25,lng:-79.99},line)<1)
  assert.ok(distanceFromNavigationPath({lat:25.002,lng:-79.99},line)>200)
})

test('progress splits a sparse segment exactly at the driver, without cutting a corner',()=>{
  const line=[{lat:25,lng:-80},{lat:25,lng:-79.99},{lat:25.01,lng:-79.99}]
  const progress=projectNavigationPosition({lat:25,lng:-79.995},line)
  assert.equal(progress.segmentIndex,0)
  assert.ok(progress.distanceFromRoute<.01)
  assert.ok(Math.abs(progress.heading-90)<.01)
  const split=splitNavigationPath(line,progress)
  assert.deepEqual(split.traveled,[line[0],progress.coordinate])
  assert.deepEqual(split.pending,[progress.coordinate,...line.slice(1)])
  assert.ok(progress.remainingMeters<progress.totalMeters)
  assert.ok(progress.traveledMeters>400)
})

test('a looping route does not jump ahead at an overlapping road',()=>{
  const line=[{lat:25,lng:-80},{lat:25,lng:-79.99},{lat:25.01,lng:-79.99},{lat:25.01,lng:-80},{lat:25,lng:-80},{lat:25,lng:-79.99}]
  const first=projectNavigationPosition({lat:25,lng:-79.999},line,0)
  assert.equal(first.segmentIndex,0)
  const later=projectNavigationPosition({lat:25,lng:-79.999},line,4300,400)
  assert.equal(later.segmentIndex,4)
  assert.ok(later.traveledMeters>4000)
})

test('route projection handles empty, repeated and endpoint positions',()=>{
  const a={lat:25,lng:-80},b={lat:25,lng:-79.99}
  assert.equal(projectNavigationPosition(a,[]),null)
  assert.equal(projectNavigationPosition(a,[a,a]),null)
  const end=projectNavigationPosition(b,[a,a,b])
  assert.equal(end.remainingMeters,0)
  assert.equal(end.segmentIndex,1)
  assert.deepEqual(splitNavigationPath([a,b],null),{traveled:[],pending:[a,b]})
})

test('turn guidance advances using step start boundaries, not closest vertices',()=>{
  const line=[{lat:25,lng:-80},{lat:25,lng:-79.99},{lat:25.01,lng:-79.99}]
  const start=projectNavigationPosition(line[0],line)
  const firstLeg=start.totalMeters-1113.2
  const steps=[{instruction:'Head east',distanceMeters:firstLeg,coordinate:line[0]},{instruction:'Turn left',distanceMeters:1113.2,coordinate:line[1]}]
  const middle=projectNavigationPosition({lat:25,lng:-79.995},line)
  const turn=navigationManeuver(steps,middle,start.totalMeters)
  assert.equal(turn.instruction,'Turn left')
  assert.ok(Math.abs(turn.distanceToManeuverMeters-firstLeg/2)<1)
  const past=projectNavigationPosition({lat:25.001,lng:-79.99},line)
  assert.equal(navigationManeuver(steps,past,start.totalMeters),null)
})

test('remaining ETA declines with actual progress and is unavailable without a route',()=>{
  const line=[{lat:25,lng:-80},{lat:25,lng:-79.99}]
  const start=projectNavigationPosition(line[0],line)
  const middle=projectNavigationPosition({lat:25,lng:-79.995},line)
  const end=projectNavigationPosition(line[1],line)
  assert.equal(navigationRemainingSeconds(600,start),600)
  assert.ok(Math.abs(navigationRemainingSeconds(600,middle)-300)<.01)
  assert.equal(navigationRemainingSeconds(600,end),0)
  assert.equal(navigationRemainingSeconds(undefined,start),null)
  assert.equal(navigationRemainingSeconds(600,null),null)
})

test('camera rotates across north by the short path, not a full spin',()=>{
  assert.equal(interpolateHeading(350,10,.5),0)
  assert.equal(interpolateHeading(10,350,.5),0)
  assert.equal(interpolateHeading(90,180,1),180)
})

test('missing accuracy or timestamp never masquerades as live GPS',()=>{
  assert.equal(usableNavigationFix({accuracy:Infinity,updatedAt:100000},100000),false)
  assert.equal(usableNavigationFix({accuracy:10,updatedAt:0},100000),false)
})

test('Driver navigation has its own surface and Manager keeps its previous component',async()=>{
  const driver=await readFile(new URL('../app/driver-route-navigation.tsx',import.meta.url),'utf8')
  const manager=await readFile(new URL('../app/routes/live-route.tsx',import.meta.url),'utf8')
  const navigation=await readFile(new URL('../app/driver-navigation-map.tsx',import.meta.url),'utf8')
  assert.match(driver,/import\('\.\/driver-navigation-map'\)/)
  assert.match(manager,/import\('\.\.\/route-plan-map'\)/)
  assert.doesNotMatch(manager,/driver-navigation-map/)
  assert.doesNotMatch(navigation,/supabase|OperationsMap|Leaflet|markArrived\(/)
  assert.match(navigation,/navigationProgress=\{currentProgress\}/)
  assert.match(navigation,/source==='google'\?estimate\.coordinates:\[\]/)
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
