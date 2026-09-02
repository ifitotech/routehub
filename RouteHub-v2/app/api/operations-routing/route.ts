import {NextRequest,NextResponse} from 'next/server'
import {sanitizeCoordinate, type MapPoint} from '../../../lib/maps/coordinates'

type CachedRoute={expires:number;value:{coordinates:MapPoint[];distanceMeters?:number;durationSeconds?:number}}

const cache=new Map<string,CachedRoute>()
const maxPoints=25
const cacheMs=10*60*1000

function validPoints(value:unknown):MapPoint[]{
 if(!Array.isArray(value))return []
 return value.slice(0,maxPoints).map(point=>sanitizeCoordinate(point as {lat?:unknown;lng?:unknown})).filter((point):point is MapPoint=>Boolean(point))
}

function keyFor(points:MapPoint[]){
 return points.map(point=>`${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|')
}

/** Server-side OSRM keeps Operations Map independent from Google quota and browser CORS. */
export async function POST(request:NextRequest){
 let points:MapPoint[]=[]
 try{points=validPoints((await request.json() as {points?:unknown}).points)}catch{points=[]}
 if(points.length<2)return NextResponse.json({coordinates:points})

 const key=keyFor(points)
 const cached=cache.get(key)
 if(cached&&cached.expires>Date.now())return NextResponse.json(cached.value,{headers:{'x-routehub-cache':'hit'}})

 const coordinates=points.map(point=>`${point.lng},${point.lat}`).join(';')
 try{
  const response=await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,{
   headers:{accept:'application/json'},
   cache:'no-store',
   signal:AbortSignal.timeout(8_000),
  })
  if(!response.ok)return NextResponse.json({coordinates:points},{status:response.status})
  const payload=await response.json() as {routes?:Array<{distance?:number;duration?:number;geometry?:{coordinates?:Array<[number,number]>}}>}
  const route=payload.routes?.[0]
  const line=(route?.geometry?.coordinates||[]).map(([lng,lat])=>sanitizeCoordinate({lat,lng})).filter((point):point is MapPoint=>Boolean(point))
  const value={coordinates:line.length>1?line:points,distanceMeters:route?.distance,durationSeconds:route?.duration}
  cache.set(key,{expires:Date.now()+cacheMs,value})
  return NextResponse.json(value,{headers:{'x-routehub-cache':'miss'}})
 }catch{
  return NextResponse.json({coordinates:points},{status:502})
 }
}
