'use client'

import {Fragment,useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {Truck} from 'lucide-react'
import {geocodeAddress} from '../lib/maps/geocoding'
import {sanitizeCoordinate} from '../lib/maps/coordinates'
import {calculateOperationsRoute} from '../lib/maps/routing'
import {buildOperationsSequence,isDrawableOperationsRoute,isRemainingOperationsRoute} from '../lib/maps/operations-sequence'
import styles from './operations-map.module.css'

type Coordinate={lat:number;lng:number}

export type OperationsRoute={
 id:string
 mission_type?:string|null
 origin_address?:string|null
 destination_address?:string|null
 destination_name?:string|null
 origin_lat?:number|null
 origin_lng?:number|null
 destination_lat?:number|null
 destination_lng?:number|null
 status?:string|null
 driver_id?:string|null
 position?:number|null
}

export type OperationsDriverLocation={
 id:string
 driver_id:string
 location:Coordinate
 label?:string
 avatarUrl?:string|null
 updatedAt?:string|null
 status?:'driving'|'on_route'|'available'|'unavailable'
 nextStop?:string|null
}

type ResolvedRoute=OperationsRoute&{origin:Coordinate|null;destination:Coordinate|null;number:number}
type ResolvedSequence={
 key:string
 driverId:string|null
 routes:ResolvedRoute[]
 start:Coordinate|null
 line:Coordinate[]
 color:string
 street?:boolean
 distanceMeters?:number
 durationSeconds?:number
}
type Summary={count:number;distanceMeters?:number;durationSeconds?:number}
type Props={
 routes:OperationsRoute[]
 driverLocations?:OperationsDriverLocation[]
 fitDriverLocations?:boolean
 locale?:string
 interactive?:boolean
 hideFooter?:boolean
 onSummary?:(summary:Summary|null)=>void
}

const miamiCenter:Coordinate={lat:25.9017,lng:-80.3078}
const asPoint=(lat:number|null|undefined,lng:number|null|undefined):Coordinate|null=>sanitizeCoordinate({lat,lng})
const isRemaining=isRemainingOperationsRoute
const sequenceColors=['#1667F2','#7c3aed','#0891b2','#ea580c','#16a34a']

function routeColor(status?:string|null){
 if(status==='issue')return '#E11D48'
 if(status==='completed')return '#94a3b8'
 if(status==='active'||status==='paused')return '#1667F2'
 return '#1667F2'
}

function routeTypeLabel(type:string|null|undefined,locale:string){
 if(locale==='es')return type==='pickup'?'Recogida':type==='delivery'?'Entrega':type==='return'?'Regreso':'Parada'
 if(locale==='fr')return type==='pickup'?'Collecte':type==='delivery'?'Livraison':type==='return'?'Retour':'Arrêt'
 return type==='pickup'?'Pickup':type==='delivery'?'Delivery':type==='return'?'Return':'Stop'
}

function statusLabel(status:string|undefined|null,locale:string){
 if(locale==='es')return status==='issue'?'Incidencia':status==='completed'?'Completada':status==='active'||status==='paused'?'En curso':'Pendiente'
 if(locale==='fr')return status==='issue'?'Incident':status==='completed'?'Terminé':status==='active'||status==='paused'?'En cours':'En attente'
 return status==='issue'?'Issue':status==='completed'?'Completed':status==='active'||status==='paused'?'In progress':'Pending'
}

function routeMarker(number:number,color:string,completed=false){
 return L.divIcon({
  className:'operations-route-marker-wrap',
  html:`<span class="operations-route-marker${completed?' is-completed':''}" style="--marker-color:${color}">${number}</span>`,
  iconSize:[36,42],
  iconAnchor:[18,38],
 })
}

function originMarker(color:string){
 return L.divIcon({
  className:'operations-origin-marker-wrap',
  html:`<span class="operations-origin-marker" style="--marker-color:${color}">S</span>`,
  iconSize:[24,24],
  iconAnchor:[12,12],
 })
}

function driverMarker(driver:OperationsDriverLocation){
 const status=driver.status==='unavailable'?'is-offline':'is-online'
 return L.divIcon({
  className:'operations-driver-marker-wrap',
  html:`<span class="operations-driver-marker ${status}" aria-hidden="true"><svg class="operations-driver-truck" viewBox="0 0 24 24" focusable="false"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2M15 18H9M19 18h1a2 2 0 0 0 2-2v-3.5a2 2 0 0 0-.59-1.41l-3.5-3.5A2 2 0 0 0 16.5 7H14M9 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM20 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/></svg><i></i></span>`,
  iconSize:[30,30],
  iconAnchor:[15,15],
 })
}

function FitBounds({points}:{points:Coordinate[]}){
 const map=useMap()
 const pointsRef=useRef(points)
 pointsRef.current=points
 const pointKey=points.map(point=>`${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join('|')
 useEffect(()=>{
  const currentPoints=pointsRef.current
  const frame=window.requestAnimationFrame(()=>{
   map.invalidateSize()
   window.requestAnimationFrame(()=>map.invalidateSize())
  })
  if(!currentPoints.length){map.setView([miamiCenter.lat,miamiCenter.lng],12);return ()=>window.cancelAnimationFrame(frame)}
  if(currentPoints.length===1){map.setView([currentPoints[0].lat,currentPoints[0].lng],14);return ()=>window.cancelAnimationFrame(frame)}
  map.fitBounds(currentPoints.map(point=>[point.lat,point.lng] as [number,number]),{padding:[36,36],maxZoom:14})
  return ()=>window.cancelAnimationFrame(frame)
 },[map,pointKey])
 return null
}

function sortRoutes(routes:OperationsRoute[]){
 return routes.slice().sort((a,b)=>Number(a.position||Number.MAX_SAFE_INTEGER)-Number(b.position||Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id))
}

function withNumbers(routes:Array<OperationsRoute&{origin:Coordinate|null;destination:Coordinate|null}>):ResolvedRoute[]{
 const remaining=routes.filter(route=>isDrawableOperationsRoute(route.status)&&route.destination)
 const numbers=new Map<string,number>()
 remaining.forEach((route,index)=>numbers.set(route.id,index+1))
 return routes.map((route,index)=>({...route,number:numbers.get(route.id)||(Number(route.position)>0?Number(route.position):index+1)}))
}

function buildSequence(groupRoutes:ResolvedRoute[],color:string,key:string,driverId:string|null,driverStart:Coordinate|null=null){
 const sequence=buildOperationsSequence(groupRoutes,driverStart)
 return {key,driverId,routes:sequence.ordered,start:sequence.start,line:sequence.points,color,points:sequence.points,distanceMeters:undefined,durationSeconds:undefined}
}

type RouteLineSegment={key:string;points:Coordinate[];color:string}

function nearestLinePoint(line:Coordinate[],target:Coordinate,startAt:number){
 let index=startAt
 let best=Number.POSITIVE_INFINITY
 for(let candidate=startAt;candidate<line.length;candidate++){
  const point=line[candidate]
  const distance=(point.lat-target.lat)**2+(point.lng-target.lng)**2
  if(distance<best){best=distance;index=candidate}
 }
 return index
}

/**
 * A driver's assignment is one ordered route. Render it as non-overlapping
 * status segments so the operations map never stacks duplicate blue lines.
 * Completed work stays gray only while there is work still pending; a fully
 * completed assignment disappears from the route drawing altogether.
 */
function routeLineSegments(sequence:ResolvedSequence):RouteLineSegment[]{
 if(sequence.line.length<2||!sequence.routes.some(route=>isRemaining(route.status)))return []
 const segments:RouteLineSegment[]=[]
 let startAt=0
 for(const route of sequence.routes){
  if(!route.destination)continue
  const endAt=nearestLinePoint(sequence.line,route.destination,startAt)
  if(endAt<=startAt)continue
  const color=route.status==='completed'?'#94a3b8':isRemaining(route.status)?sequence.color:null
  if(color){
   const points=sequence.line.slice(startAt,endAt+1)
   const previous=segments[segments.length-1]
   if(previous?.color===color)previous.points.push(...points.slice(1))
   else segments.push({key:`${route.id}-${startAt}-${endAt}`,points,color})
  }
  startAt=endAt
 }
 return segments
}

async function resolveCoordinate(address:string|null|undefined,lat:number|null|undefined,lng:number|null|undefined){
 const known=asPoint(lat,lng)
 if(known)return known
 if(!address)return null
 try{return (await geocodeAddress(address))?.coordinate||null}catch{return null}
}

export default function OperationsMap({routes,driverLocations=[],fitDriverLocations=false,locale='en',interactive=true,hideFooter=false,onSummary}:Props){
 const [resolved,setResolved]=useState<ResolvedRoute[]>([])
 const [sequences,setSequences]=useState<ResolvedSequence[]>([])
 const summaryRef=useRef(onSummary)
 const operationsDataRef=useRef([] as OperationsRoute[])
 const driverLocationsRef=useRef(driverLocations)
 summaryRef.current=onSummary
 driverLocationsRef.current=driverLocations

 const visibleRoutes=useMemo(()=>sortRoutes(routes.filter(route=>route.origin_address||route.destination_address||asPoint(route.origin_lat,route.origin_lng)||asPoint(route.destination_lat,route.destination_lng))),[routes])
 const routeKey=visibleRoutes.map(route=>[route.id,route.mission_type,route.origin_address,route.destination_address,route.origin_lat,route.origin_lng,route.destination_lat,route.destination_lng,route.status,route.driver_id,route.position].join(':')).join('|')
 operationsDataRef.current=visibleRoutes

 useEffect(()=>{
  let cancelled=false
  const routesForMap=operationsDataRef.current
  const instant=withNumbers(routesForMap.map(route=>({
   ...route,
   origin:asPoint(route.origin_lat,route.origin_lng),
   destination:asPoint(route.destination_lat,route.destination_lng),
  })))
  const grouped=new Map<string,ResolvedRoute[]>()
  for(const route of instant){
   const key=route.driver_id||'unassigned'
   grouped.set(key,[...(grouped.get(key)||[]),route])
  }
  const driverStartById=new Map(driverLocationsRef.current.flatMap(driver=>{
   const location=sanitizeCoordinate(driver.location)
   return location?[[driver.driver_id,location] as const]:[]
  }))
  const draft:Array<ResolvedSequence&{points:Coordinate[]}>=[...grouped.entries()].map(([key,groupRoutes],index)=>buildSequence(groupRoutes,sequenceColors[index%sequenceColors.length],key,key==='unassigned'?null:key,driverStartById.get(key)||null))
  setResolved(instant)
  setSequences(draft.map(({points: _points,...sequence})=>sequence))
  summaryRef.current?.({count:draft.reduce((total,sequence)=>total+sequence.routes.filter(route=>isRemaining(route.status)).length,0)})

  void (async()=>{
   const hydrated=withNumbers(await Promise.all(routesForMap.map(async route=>{
    const [origin,destination]=await Promise.all([
     resolveCoordinate(route.origin_address,route.origin_lat,route.origin_lng),
     resolveCoordinate(route.destination_address,route.destination_lat,route.destination_lng),
    ])
    return {...route,origin,destination}
   })))
   if(cancelled)return
   const nextGroups=new Map<string,ResolvedRoute[]>()
   for(const route of hydrated){
    const key=route.driver_id||'unassigned'
    nextGroups.set(key,[...(nextGroups.get(key)||[]),route])
   }
   const ready:Array<ResolvedSequence&{points:Coordinate[]}>=[...nextGroups.entries()].map(([key,groupRoutes],index)=>buildSequence(groupRoutes,sequenceColors[index%sequenceColors.length],key,key==='unassigned'?null:key,driverStartById.get(key)||null))
   setResolved(hydrated)
   setSequences(ready.map(({points: _points,...sequence})=>sequence))
   const built=await Promise.all(ready.map(async sequence=>{
    try{
     const estimate=sequence.points.length>1?await calculateOperationsRoute(sequence.points,undefined,locale,false):null
     const routed=estimate?.coordinates
     const street=!!routed&&routed.length>sequence.points.length
     return {
      ...sequence,
      line:street&&routed?routed:sequence.points,
      street,
      distanceMeters:estimate?.distanceMeters,
      durationSeconds:estimate?.durationSeconds,
     }
    }catch{
     return sequence
    }
   }))
   if(cancelled)return
   setSequences(built.map(({points: _points,...sequence})=>sequence))
   summaryRef.current?.({
    count:built.reduce((total,sequence)=>total+sequence.routes.filter(route=>isRemaining(route.status)).length,0),
    distanceMeters:built.some(sequence=>Number.isFinite(sequence.distanceMeters))?built.reduce((total,sequence)=>total+(sequence.distanceMeters||0),0):undefined,
    durationSeconds:built.some(sequence=>Number.isFinite(sequence.durationSeconds))?built.reduce((total,sequence)=>total+(sequence.durationSeconds||0),0):undefined,
   })
  })()

  return()=>{cancelled=true}
 },[locale,routeKey])

 const visibleDriverLocations=useMemo(()=>driverLocations
  .map(driver=>({...driver,location:sanitizeCoordinate(driver.location)}))
  .filter((driver):driver is OperationsDriverLocation&{location:Coordinate}=>Boolean(driver.location)),[driverLocations])
 const allPoints=useMemo(()=>{
 const operational=[
   ...sequences.map(sequence=>sequence.start),
   ...resolved.filter(route=>isDrawableOperationsRoute(route.status)).map(route=>route.destination),
  ].filter((point):point is Coordinate=>Boolean(point))
  return operational.length?operational:visibleDriverLocations.map(driver=>driver.location)
 },[resolved,sequences,visibleDriverLocations])
 const fitPoints=useMemo(()=>{
  const assigned=[
   ...sequences.map(sequence=>sequence.start),
   ...resolved.filter(route=>isDrawableOperationsRoute(route.status)).map(route=>route.destination),
   ...sequences.flatMap(sequence=>sequence.line),
  ].filter((point):point is Coordinate=>Boolean(point))
  if(!assigned.length)return visibleDriverLocations.map(driver=>driver.location)
  return fitDriverLocations?[...assigned,...visibleDriverLocations.map(driver=>driver.location)]:assigned
 },[fitDriverLocations,resolved,sequences,visibleDriverLocations])
 const center=(fitPoints[0]||allPoints[0]||miamiCenter)
 const copy=locale==='es'
  ?{label:'Mapa operativo de rutas',unavailable:'No hay paradas con ubicación todavía.',current:'En curso',pending:'Pendiente',completed:'Completada',issue:'Incidencia',driver:'Conductor',start:'Inicio'}
  :locale==='fr'
   ?{label:'Carte opérationnelle des itinéraires',unavailable:'Aucun arrêt avec position pour le moment.',current:'En cours',pending:'En attente',completed:'Terminé',issue:'Incident',driver:'Conducteur',start:'Départ'}
   :{label:'Route operations map',unavailable:'No stops with a location yet.',current:'In progress',pending:'Pending',completed:'Completed',issue:'Issue',driver:'Driver',start:'Start'}

 const hasOperationalInput=visibleRoutes.length>0

 return <section className={styles.map} aria-label={copy.label}>
  <div className={styles.canvas}>
   <MapContainer center={[center.lat,center.lng]} zoom={12} scrollWheelZoom={false} dragging={interactive} touchZoom={interactive} doubleClickZoom={interactive} zoomControl={interactive}>
    <TileLayer attribution='© OpenStreetMap contributors' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'/>
    <FitBounds points={fitPoints}/>
    {sequences.map(sequence=><Fragment key={`sequence-${sequence.key}`}>
     {routeLineSegments(sequence).map(segment=><Polyline key={segment.key} positions={segment.points.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:segment.color,weight:6,opacity:.96,lineCap:'round',lineJoin:'round',dashArray:sequence.street?undefined:'10 8'}}/>)}
      {sequence.start&&<Marker position={[sequence.start.lat,sequence.start.lng]} icon={originMarker(sequence.color)}><Tooltip direction="top" offset={[0,-14]}>{copy.start}</Tooltip></Marker>}
    </Fragment>)}
    {resolved.filter(route=>isDrawableOperationsRoute(route.status)).map(route=>route.destination&&<Marker key={`route-${route.id}`} position={[route.destination.lat,route.destination.lng]} icon={routeMarker(route.number,routeColor(route.status),route.status==='completed')} zIndexOffset={route.status==='active'||route.status==='paused'?500:300}>
     <Tooltip direction="top" offset={[0,-20]}>{`${route.number}. ${routeTypeLabel(route.mission_type,locale)} · ${route.destination_name||route.destination_address||copy.driver} · ${statusLabel(route.status,locale)}`}</Tooltip>
    </Marker>)}
    {visibleDriverLocations.map(driver=><Marker key={`driver-${driver.id}`} position={[driver.location.lat,driver.location.lng]} icon={driverMarker(driver)} zIndexOffset={700}>
      <Tooltip direction="top" offset={[0,-24]}>{driver.label||driver.nextStop||copy.driver}</Tooltip>
    </Marker>)}
    </MapContainer>
    {!hasOperationalInput&&<div className={styles.emptyOverlay}>{copy.unavailable}</div>}
    <div className={styles.legend} aria-label={copy.label}><span><i className={styles.current}/>{copy.current}</span><span><i className={styles.pending}/>{copy.pending}</span><span><i className={styles.completed}/>{copy.completed}</span><span><i className={styles.issue}/>{copy.issue}</span><span><Truck size={13}/>{visibleRoutes.length} {locale==='es'?'rutas':locale==='fr'?'itinéraires':'routes'}</span></div>
  </div>
  {!hideFooter&&<footer><span>{visibleRoutes.length} {locale==='es'?'rutas':locale==='fr'?'itinéraires':'routes'}</span><small>{locale==='es'?'Vista de rutas asignadas':locale==='fr'?'Vue des itinéraires attribués':'Assigned routes view'}</small></footer>}
 </section>
}
