import {NextRequest,NextResponse} from 'next/server'
import {mapProviderLimits} from '../../../lib/maps/map-config'
import type {MapCoordinate,RouteEstimate,RouteManeuver} from '../../../lib/maps/types'

type GoogleRoutePayload={
 routes?:Array<{
  distanceMeters?:number
  duration?:string
  polyline?:{encodedPolyline?:string}
  legs?:Array<{steps?:Array<{distanceMeters?:number;startLocation?:{latLng?:{latitude?:number;longitude?:number}};navigationInstruction?:{instructions?:string;maneuver?:string}}>}>
 }>
}

const routeCache=new Map<string,{expires:number;value:RouteEstimate}>()

function validPoints(value:unknown):MapCoordinate[]{
 if(!Array.isArray(value))return []
 return value.slice(0,mapProviderLimits.maximumRoutePoints).flatMap(item=>{
  if(!item||typeof item!=='object')return []
  const lat=Number((item as {lat?:unknown}).lat),lng=Number((item as {lng?:unknown}).lng)
  return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180?[{lat,lng}]:[]
 })
}

function decodePolyline(encoded:string):MapCoordinate[]{
 const result:MapCoordinate[]=[]
 let index=0,lat=0,lng=0
 while(index<encoded.length){
  let shift=0,value=0,byte=0
  do{byte=encoded.charCodeAt(index++)-63;value|=(byte&0x1f)<<shift;shift+=5}while(byte>=0x20&&index<=encoded.length)
  lat+=(value&1)?~(value>>1):(value>>1)
  shift=0;value=0
  do{byte=encoded.charCodeAt(index++)-63;value|=(byte&0x1f)<<shift;shift+=5}while(byte>=0x20&&index<=encoded.length)
  lng+=(value&1)?~(value>>1):(value>>1)
  result.push({lat:lat/1e5,lng:lng/1e5})
 }
 return result
}

function seconds(value:string|undefined){
 const parsed=Number(String(value||'').replace(/s$/,''))
 return Number.isFinite(parsed)?parsed:undefined
}

function cacheKey(points:MapCoordinate[]){
 return points.map(point=>`${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|')
}

export async function POST(request:NextRequest){
 let points:MapCoordinate[]=[]
 try{points=validPoints((await request.json() as {points?:unknown}).points)}catch{points=[]}
 if(points.length<2)return NextResponse.json({coordinates:points,source:'fallback'})
 const key=process.env.GOOGLE_MAPS_SERVER_KEY
 if(!key)return NextResponse.json({coordinates:points,source:'fallback',error:'Routes API is not configured.'},{status:503})

 const lookup=cacheKey(points)
 const cached=routeCache.get(lookup)
 if(cached&&cached.expires>Date.now())return NextResponse.json(cached.value,{headers:{'x-routehub-cache':'hit'}})
 const waypoint=(point:MapCoordinate)=>({location:{latLng:{latitude:point.lat,longitude:point.lng}}})
 const body={
  origin:waypoint(points[0]),
  destination:waypoint(points[points.length-1]),
  intermediates:points.slice(1,-1).map(waypoint),
  travelMode:'DRIVE',
  routingPreference:'TRAFFIC_UNAWARE',
  computeAlternativeRoutes:false,
  languageCode:'en-US',
  units:'IMPERIAL',
  polylineQuality:'OVERVIEW',
  polylineEncoding:'ENCODED_POLYLINE',
 }
 try{
  const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{
   method:'POST',
   headers:{'content-type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.startLocation.latLng,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.navigationInstruction.maneuver'},
   body:JSON.stringify(body),
   cache:'no-store',
   signal:AbortSignal.timeout(mapProviderLimits.routeTimeoutMs),
  })
  if(!response.ok)return NextResponse.json({coordinates:points,source:'fallback'},{status:response.status})
  const payload=await response.json() as GoogleRoutePayload
  const route=payload.routes?.[0]
  const encoded=route?.polyline?.encodedPolyline||''
  const maneuvers:RouteManeuver[]=(route?.legs||[]).flatMap(leg=>(leg.steps||[]).flatMap(step=>{
   const location=step.startLocation?.latLng
   if(!Number.isFinite(location?.latitude)||!Number.isFinite(location?.longitude))return []
   return [{instruction:step.navigationInstruction?.instructions||'Continue',distanceMeters:step.distanceMeters,coordinate:{lat:Number(location?.latitude),lng:Number(location?.longitude)},type:step.navigationInstruction?.maneuver}]
  }))
  const value:RouteEstimate={coordinates:encoded?decodePolyline(encoded):points,distanceMeters:route?.distanceMeters,durationSeconds:seconds(route?.duration),source:encoded?'google':'fallback',maneuvers}
  routeCache.set(lookup,{expires:Date.now()+mapProviderLimits.routeCacheMs,value})
  return NextResponse.json(value,{headers:{'x-routehub-cache':'miss'}})
 }catch{
  return NextResponse.json({coordinates:points,source:'fallback'},{status:502})
 }
}
