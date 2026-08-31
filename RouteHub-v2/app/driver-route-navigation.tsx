'use client'

import dynamic from 'next/dynamic'
import {stopKind} from '../lib/stop-workflow'
import type {PlannedStop} from './route-plan-map'

const RoutePlanMap=dynamic(()=>import('./route-plan-map').then(mod=>mod.default),{ssr:false})

export type NavigationStop={
  id:string
  destination_address?:string|null
  destination_name?:string|null
  destination_lat?:number|null
  destination_lng?:number|null
  origin_lat?:number|null
  origin_lng?:number|null
  mission_type?:string|null
  order_number?:string|null
  notes?:string|null
  position?:number|null
  status?:string|null
  route_date?:string|null
}

type Props={
  stops:NavigationStop[]
  originAddress?:string|null
  originCoordinate?:{lat:number;lng:number}|null
  locale?:string
  sharedLocation?:{lat:number;lng:number}|null
  onArrive?:()=>void|Promise<void>
  onExit?:()=>void
}

export default function DriverRouteNavigation({stops,originAddress,originCoordinate=null,locale='en',sharedLocation=null,onArrive,onExit}:Props){
  const sorted=stops.filter(stop=>stop.status!=='cancelled').slice().sort((left,right)=>Number(left.position||0)-Number(right.position||0)||left.id.localeCompare(right.id))
  const open=sorted.filter(stop=>!['completed','issue'].includes(String(stop.status||'')))
  const planned:PlannedStop[]=(open.length?open:sorted).map(stop=>({
    id:stop.id,
    address:stop.destination_address,
    label:stop.destination_name||stop.destination_address,
    kind:stopKind(stop.mission_type),
    orderNumber:stop.order_number,
    notes:stop.notes,
    position:Number(stop.position||0),
    pastDue:Boolean(stop.route_date&&stop.status&&!['completed','cancelled'].includes(stop.status)&&stop.route_date.slice(0,10)<new Date().toISOString().slice(0,10)),
    pending:['published','pending'].includes(String(stop.status||'')),
    coordinate:stop.destination_lat!=null&&stop.destination_lng!=null?{lat:Number(stop.destination_lat),lng:Number(stop.destination_lng)}:null,
  }))
  const originFromStops=sorted.find(stop=>stop.origin_lat!=null&&stop.origin_lng!=null)
  const resolvedOrigin=originCoordinate||(originFromStops?{lat:Number(originFromStops.origin_lat),lng:Number(originFromStops.origin_lng)}:null)

  return <RoutePlanMap originAddress={originAddress} originCoordinate={resolvedOrigin} stops={planned} locale={locale} navigationOnly autoStartNavigation trackDevice={false} sharedLocation={sharedLocation} onArrive={onArrive} onExitNavigation={onExit} onReturnToday={onExit}/>
}
