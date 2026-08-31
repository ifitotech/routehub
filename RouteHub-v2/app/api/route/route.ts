import {NextRequest,NextResponse} from 'next/server'
import {mapProviderLimits,routingConfig} from '../../../lib/maps/map-config'
import {normalizeOsrmRoute} from '../../../lib/maps/routing'
import type {MapCoordinate} from '../../../lib/maps/types'

function validPoints(value:unknown):MapCoordinate[]{
  if(!Array.isArray(value))return []
  return value.flatMap(item=>{
    if(!item||typeof item!=='object')return []
    const lat=Number((item as {lat?:unknown}).lat)
    const lng=Number((item as {lng?:unknown}).lng)
    return Number.isFinite(lat)&&Number.isFinite(lng)?[{lat,lng}]:[]
  })
}

export async function POST(request:NextRequest){
  let points:MapCoordinate[]=[]
  try{points=validPoints((await request.json() as {points?:unknown}).points)}catch{points=[]}
  if(points.length<2)return NextResponse.json({coordinates:points,source:'fallback'})
  const path=points.slice(0,25).map(point=>`${point.lng},${point.lat}`).join(';')
  const url=`${routingConfig.endpoint}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`
  try{
    const result=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(mapProviderLimits.routeTimeoutMs)})
    if(!result.ok)return NextResponse.json({coordinates:points,source:'fallback'})
    return NextResponse.json(normalizeOsrmRoute(await result.json() as {routes?:Array<{distance?:number;duration?:number;geometry?:{coordinates?:Array<[number,number]>};legs?:Array<{steps?:Array<{name?:string;distance?:number;maneuver?:{type?:string;modifier?:string;location?:[number,number]}}>}>}>}>},points))
  }catch{
    return NextResponse.json({coordinates:points,source:'fallback'})
  }
}
