import {mapProviderLimits} from './map-config'
import {sanitizeCoordinate} from './coordinates'
import type {ActiveRouteManeuver,MapCoordinate,RouteEstimate,RouteManeuver} from './types'

export function distanceMeters(a:MapCoordinate,b:MapCoordinate){
  const radians=Math.PI/180
  const dLat=(b.lat-a.lat)*radians,dLng=(b.lng-a.lng)*radians
  const value=Math.sin(dLat/2)**2+Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(dLng/2)**2
  return 2*6371000*Math.atan2(Math.sqrt(value),Math.sqrt(1-value))
}

function geometryMatchesEndpoints(line:MapCoordinate[],points:MapCoordinate[]){
 if(line.length<2||points.length<2)return false
 const start=line[0],end=line[line.length-1]
 if(!start||!end)return false
 return distanceMeters(start,points[0])<=20_000&&distanceMeters(end,points[points.length-1])<=20_000
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

export async function calculateRoute(points:MapCoordinate[],signal?:AbortSignal,locale='en',trafficAware=false):Promise<RouteEstimate>{
  const fallback={coordinates:points,source:'fallback' as const}
  if(points.length<2)return fallback
  try{
    const response=await fetch('/api/routing',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({points:points.slice(0,25),locale,trafficAware}),
      signal:signal||AbortSignal.timeout(mapProviderLimits.routeTimeoutMs+2_000),
    })
    if(!response.ok)return fallback
    const payload=await response.json() as Partial<RouteEstimate>
    if(Array.isArray(payload.coordinates)&&payload.coordinates.length>1){
      const coordinates=payload.coordinates.map(point=>sanitizeCoordinate(point)).filter((point):point is MapCoordinate=>Boolean(point))
      const safeCoordinates=geometryMatchesEndpoints(coordinates,points)?coordinates:points
      return {
        coordinates:safeCoordinates,
        distanceMeters:payload.distanceMeters,
        durationSeconds:payload.durationSeconds,
        staticDurationSeconds:payload.staticDurationSeconds,
        nextStopDistanceMeters:payload.nextStopDistanceMeters,
        nextStopDurationSeconds:payload.nextStopDurationSeconds,
        nextStopStaticDurationSeconds:payload.nextStopStaticDurationSeconds,
        source:payload.source==='google'&&safeCoordinates===coordinates?'google':'fallback',
        maneuvers:payload.maneuvers,
      }
    }
    return fallback
  }catch{return fallback}
}

/**
 * Route previews prefer Google's road geometry when it is configured, while
 * retaining the quota-free OSRM service as an operational fallback. Both
 * endpoints cache by coordinate sequence, so a React render does not create a
 * new provider request.
 */
export async function calculateOperationsRoute(points:MapCoordinate[],signal?:AbortSignal,locale='en',trafficAware=false):Promise<RouteEstimate>{
  const google=await calculateRoute(points,signal,locale,trafficAware)
  if(google.source==='google')return google
  if(points.length<2)return google
  try{
    const response=await fetch('/api/operations-routing',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({points:points.slice(0,mapProviderLimits.maximumRoutePoints)}),
      signal:signal||AbortSignal.timeout(mapProviderLimits.routeTimeoutMs+2_000),
    })
    if(!response.ok)return google
    const payload=await response.json() as Partial<RouteEstimate>
    const coordinates=Array.isArray(payload.coordinates)
      ?payload.coordinates.map(point=>sanitizeCoordinate(point)).filter((point):point is MapCoordinate=>Boolean(point))
      :[]
    const safeCoordinates=geometryMatchesEndpoints(coordinates,points)?coordinates:points
    return {
      coordinates:safeCoordinates,
      distanceMeters:payload.distanceMeters,
      durationSeconds:payload.durationSeconds,
      source:'fallback',
    }
  }catch{return google}
}

export function formatRouteEstimate(estimate:Pick<RouteEstimate,'distanceMeters'|'durationSeconds'>,locale='en'):string|null{
  if(!Number.isFinite(estimate.distanceMeters)||!Number.isFinite(estimate.durationSeconds))return null
  const miles=(estimate.distanceMeters!/1609.344).toFixed(estimate.distanceMeters!>=16093.44?0:1)
  const minutes=Math.max(1,Math.round(estimate.durationSeconds!/60))
  return locale==='es'?`${minutes} min estimados · ${miles} mi`:locale==='fr'?`${minutes} min estimées · ${miles} mi`:`${minutes} min estimated · ${miles} mi`
}
