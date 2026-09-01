import {mapProviderLimits} from './map-config'
import type {ActiveRouteManeuver,MapCoordinate,RouteEstimate,RouteManeuver} from './types'

export function distanceMeters(a:MapCoordinate,b:MapCoordinate){
  const radians=Math.PI/180
  const dLat=(b.lat-a.lat)*radians,dLng=(b.lng-a.lng)*radians
  const value=Math.sin(dLat/2)**2+Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(dLng/2)**2
  return 2*6371000*Math.atan2(Math.sqrt(value),Math.sqrt(1-value))
}

/**
 * Chooses the first maneuver still ahead of the driver's closest route point.
 * Selecting by raw geographic distance is incorrect after passing a turn: the
 * previous turn is then the closest point and would remain on screen.
 */
export function remainingRouteDistance(route:MapCoordinate[],location:MapCoordinate|null){
  if(!route.length)return {distanceMeters:0,nearestIndex:0,distanceFromRouteMeters:0}
  const nearestIndex=!location?0:route.reduce((best,point,index)=>distanceMeters(location,point)<distanceMeters(location,route[best])?index:best,0)
  let remaining=location?distanceMeters(location,route[nearestIndex]):0
  for(let index=nearestIndex;index<route.length-1;index+=1)remaining+=distanceMeters(route[index],route[index+1])
  return {distanceMeters:remaining,nearestIndex,distanceFromRouteMeters:location?distanceMeters(location,route[nearestIndex]):0}
}

export function nextRouteManeuver(maneuvers:RouteManeuver[]|undefined,route:MapCoordinate[],location:MapCoordinate|null):ActiveRouteManeuver|undefined{
  if(!maneuvers?.length)return undefined
  if(!location||!route.length)return {...maneuvers[0],distanceToManeuverMeters:maneuvers[0].distanceMeters||0}
  const currentIndex=remainingRouteDistance(route,location).nearestIndex
  const withProgress=maneuvers.map(maneuver=>({maneuver,index:route.reduce((best,point,index)=>distanceMeters(maneuver.coordinate,point)<distanceMeters(maneuver.coordinate,route[best])?index:best,0)}))
  // Never retain a maneuver whose route point is already behind the driver.
  const active=withProgress.find(item=>item.index>=currentIndex)||withProgress[withProgress.length-1]
  let distanceToManeuver=distanceMeters(location,route[currentIndex])
  for(let index=currentIndex;index<active.index;index+=1)distanceToManeuver+=distanceMeters(route[index],route[index+1])
  return {...active.maneuver,distanceToManeuverMeters:Math.max(0,distanceToManeuver)}
}

export async function calculateRoute(points:MapCoordinate[],signal?:AbortSignal,locale='en'):Promise<RouteEstimate>{
  const fallback={coordinates:points,source:'fallback' as const}
  if(points.length<2)return fallback
  try{
    const response=await fetch('/api/routing',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({points:points.slice(0,25),locale}),
      signal:signal||AbortSignal.timeout(mapProviderLimits.routeTimeoutMs+2_000),
    })
    if(!response.ok)return fallback
    const payload=await response.json() as Partial<RouteEstimate>
    if(Array.isArray(payload.coordinates)&&payload.coordinates.length>1){
      return {
        coordinates:payload.coordinates.filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng)),
        distanceMeters:payload.distanceMeters,
        durationSeconds:payload.durationSeconds,
        staticDurationSeconds:payload.staticDurationSeconds,
        nextStopDistanceMeters:payload.nextStopDistanceMeters,
        nextStopDurationSeconds:payload.nextStopDurationSeconds,
        nextStopStaticDurationSeconds:payload.nextStopStaticDurationSeconds,
        source:payload.source==='google'?'google':'fallback',
        maneuvers:payload.maneuvers,
      }
    }
    return fallback
  }catch{return fallback}
}

export function formatRouteEstimate(estimate:Pick<RouteEstimate,'distanceMeters'|'durationSeconds'>,locale='en'):string|null{
  if(!Number.isFinite(estimate.distanceMeters)||!Number.isFinite(estimate.durationSeconds))return null
  const miles=(estimate.distanceMeters!/1609.344).toFixed(estimate.distanceMeters!>=16093.44?0:1)
  const minutes=Math.max(1,Math.round(estimate.durationSeconds!/60))
  return locale==='es'?`${minutes} min estimados · ${miles} mi`:locale==='fr'?`${minutes} min estimées · ${miles} mi`:`${minutes} min estimated · ${miles} mi`
}
