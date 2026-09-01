'use client'

import dynamic from 'next/dynamic'
import {stopKind} from '../lib/stop-workflow'
import {sanitizeCoordinate} from '../lib/maps/coordinates'
import type {PlannedStop} from './route-plan-map'

const RoutePlanMap=dynamic(()=>import('./route-plan-map'),{ssr:false})

export type NavigationStop={
  id:string
  destination_address?:string|null
  destination_name?:string|null
  destination_lat?:number|null
  destination_lng?:number|null
  origin_lat?:number|null
  origin_lng?:number|null
  origin_address?:string|null
  mission_type?:string|null
  order_number?:string|null
  notes?:string|null
  position?:number|null
  status?:string|null
  route_date?:string|null
}

type Coordinate={lat:number;lng:number}

type Waypoint={address?:string|null;label?:string|null;coordinate?:Coordinate|null}

type Props={
  stops?:NavigationStop[]
  activeStopId?:string|null
  originAddress?:string|null
  destinationAddress?:string|null
  originCoordinate?:Coordinate|null
  destinationCoordinate?:Coordinate|null
  waypoints?:Waypoint[]
  driverLocation?:Coordinate|null
  driverUpdatedAt?:string|null
  title?:string
  showHeader?:boolean
  showLocationUpdated?:boolean
  interactive?:boolean
  onActivate?:()=>void
  useDriverAsOrigin?:boolean
  locale?:string
  sharedLocation?:Coordinate|null
  disabled?:boolean
  onArrive?:()=>void|Promise<void>
  onExit?:()=>void
}

export default function DriverRouteNavigation({
  stops,
  activeStopId=null,
  originAddress,
  destinationAddress,
  originCoordinate=null,
  destinationCoordinate=null,
  waypoints=[],
  driverLocation=null,
  locale='en',
  sharedLocation=null,
  disabled=false,
  onArrive,
  onExit,
}:Props){
  const synthesized:NavigationStop[]=stops?.length?stops:[
    ...waypoints.map((point,index)=>({
      id:`waypoint-${index}`,
      destination_address:point.address,
      destination_name:point.label,
      destination_lat:point.coordinate?.lat??null,
      destination_lng:point.coordinate?.lng??null,
      position:index+1,
      status:'published',
    })),
    ...(destinationAddress||destinationCoordinate?[{
      id:'destination',
      destination_address:destinationAddress,
      destination_name:destinationAddress,
      destination_lat:destinationCoordinate?.lat??null,
      destination_lng:destinationCoordinate?.lng??null,
      origin_lat:originCoordinate?.lat??null,
      origin_lng:originCoordinate?.lng??null,
      origin_address:originAddress,
      position:(waypoints.length||0)+1,
      status:'published',
    }]:[]),
  ]
  const sorted=synthesized
    .filter(stop=>stop.status!=='cancelled')
    .slice()
    .sort((left,right)=>Number(left.position||0)-Number(right.position||0)||left.id.localeCompare(right.id))
  const remaining=sorted.filter(stop=>!['completed','issue'].includes(String(stop.status||'')))
  const activeIndex=activeStopId?remaining.findIndex(stop=>stop.id===activeStopId):-1
  const navigationStops=activeIndex>=0?remaining.slice(activeIndex):remaining
  const planned:PlannedStop[]=navigationStops.map(stop=>({
    id:stop.id,
    address:stop.destination_address,
    label:stop.destination_name||stop.destination_address,
    kind:stopKind(stop.mission_type),
    orderNumber:stop.order_number,
    notes:stop.notes,
    position:Number(stop.position||0),
    pastDue:Boolean(stop.route_date&&stop.status&&!['completed','cancelled'].includes(stop.status)&&stop.route_date.slice(0,10)<new Date().toISOString().slice(0,10)),
    pending:['published','pending'].includes(String(stop.status||'')),
    coordinate:sanitizeCoordinate({lat:stop.destination_lat,lng:stop.destination_lng}),
  }))
  const originFromStops=sorted.find(stop=>sanitizeCoordinate({lat:stop.origin_lat,lng:stop.origin_lng}))
  const gpsOrigin=sanitizeCoordinate(sharedLocation)||sanitizeCoordinate(driverLocation)
  const storedOrigin=sanitizeCoordinate(originCoordinate)||(originFromStops?sanitizeCoordinate({lat:originFromStops.origin_lat,lng:originFromStops.origin_lng}):null)
  const resolvedOrigin=gpsOrigin||storedOrigin
  const resolvedOriginAddress=gpsOrigin?null:originAddress||originFromStops?.origin_address||null

  return <RoutePlanMap originAddress={resolvedOriginAddress} originCoordinate={resolvedOrigin} stops={planned} locale={locale} navigationOnly autoStartNavigation trackDevice={false} sharedLocation={gpsOrigin||storedOrigin} arrivalDisabled={disabled} onArrive={onArrive} onExitNavigation={onExit} onReturnToday={onExit}/>
}
