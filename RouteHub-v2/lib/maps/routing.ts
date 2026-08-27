import {mapProviderLimits,routingConfig} from './map-config'
import type {MapCoordinate,RouteEstimate,RouteManeuver} from './types'

type OsrmRoute={
  distance?:number
  duration?:number
  geometry?:{coordinates?:Array<[number,number]>}
  legs?: Array<{steps?: Array<{name?: string; distance?: number; maneuver?: {type?: string; modifier?: string; location?: [number, number]}}>}> 
}

type OsrmResponse={routes?:OsrmRoute[]}

export function normalizeOsrmRoute(payload:OsrmResponse,fallback:MapCoordinate[]):RouteEstimate{
  const route=payload.routes?.[0]
  const coordinates=route?.geometry?.coordinates?.map(([lng,lat])=>({lat,lng})).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng))||[]
  const maneuvers:RouteManeuver[]=(route?.legs||[]).flatMap(leg=>(leg.steps||[]).flatMap(step=>{
    const location=step.maneuver?.location
    if(!location)return []
    const action=[step.maneuver?.type,step.maneuver?.modifier].filter(Boolean).join(' ')||'continue'
    const street=step.name?.trim()
    return [{instruction:street?`${action} onto ${street}`:action,distanceMeters:step.distance,coordinate:{lat:location[1],lng:location[0]}}]
  }))
  return {
    coordinates:coordinates.length?coordinates:fallback,
    distanceMeters:Number.isFinite(route?.distance)?route?.distance:undefined,
    durationSeconds:Number.isFinite(route?.duration)?route?.duration:undefined,
    source:coordinates.length?'osrm':'fallback'
    ,maneuvers
  }
}

export function routeRequestUrl(points:MapCoordinate[]):string|null{
  if(points.length<2)return null
  const path=points.map(point=>`${point.lng},${point.lat}`).join(';')
  return `${routingConfig.endpoint}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`
}

export async function calculateRoute(points:MapCoordinate[],signal?:AbortSignal):Promise<RouteEstimate>{
  const fallback={coordinates:points,source:'fallback' as const}
  const url=routeRequestUrl(points)
  if(!url)return fallback
  try{
    const response=await fetch(url,{signal:signal||AbortSignal.timeout(mapProviderLimits.routeTimeoutMs)})
    if(!response.ok)return fallback
    return normalizeOsrmRoute(await response.json() as OsrmResponse,points)
  }catch{return fallback}
}

export function formatRouteEstimate(estimate:Pick<RouteEstimate,'distanceMeters'|'durationSeconds'>,locale='en'):string|null{
  if(!Number.isFinite(estimate.distanceMeters)||!Number.isFinite(estimate.durationSeconds))return null
  const miles=(estimate.distanceMeters!/1609.344).toFixed(estimate.distanceMeters!>=16093.44?0:1)
  const minutes=Math.max(1,Math.round(estimate.durationSeconds!/60))
  return locale==='es'?`${minutes} min estimados · ${miles} mi`:locale==='fr'?`${minutes} min estimées · ${miles} mi`:`${minutes} min estimated · ${miles} mi`
}
