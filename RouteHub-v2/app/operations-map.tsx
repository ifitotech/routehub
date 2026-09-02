'use client'

import {Fragment,useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {Truck} from 'lucide-react'
import {geocodeAddress} from '../lib/maps/geocoding'
import {sanitizeCoordinate} from '../lib/maps/coordinates'
import styles from './operations-map.module.css'

type Coordinate={lat:number;lng:number}

async function osrmRoute(points:Coordinate[]){
  if(points.length<2)return null
  const response=await fetch('/api/operations-routing',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({points}),
   signal:AbortSignal.timeout(10_000),
  })
  if(!response.ok)throw new Error('OSRM route failed')
  const payload=await response.json() as {coordinates?:Coordinate[];distanceMeters?:number;durationSeconds?:number}
  const coordinates=(payload.coordinates||[]).map(point=>sanitizeCoordinate(point)).filter((point):point is Coordinate=>Boolean(point))
  return {coordinates,distanceMeters:payload.distanceMeters,durationSeconds:payload.durationSeconds}
}

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
 locale?:string
 interactive?:boolean
 hideFooter?:boolean
 onSummary?:(summary:Summary|null)=>void
}

const miamiCenter:Coordinate={lat:25.9017,lng:-80.3078}
const asPoint=(lat:number|null|undefined,lng:number|null|undefined):Coordinate|null=>sanitizeCoordinate({lat,lng})
const isRemaining=(status?:string|null)=>status!=='completed'&&status!=='cancelled'&&status!=='issue'
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
  html:`<span class="operations-route-marker${completed?' is-completed':''}" style="--marker-color:${color}">${completed?'✓':number}</span>`,
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

function FitBounds({points}:{points:Coordinate[]}){
 const map=useMap()
 const pointsRef=useRef(points)
 pointsRef.current=points
 const pointKey=points.map(point=>`${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join('|')
 useEffect(()=>{
  const currentPoints=pointsRef.current
  const frame=window.requestAnimationFrame(()=>map.invalidateSize())
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
 const remaining=routes.filter(route=>isRemaining(route.status)&&route.destination)
 const numbers=new Map<string,number>()
 remaining.forEach((route,index)=>numbers.set(route.id,index+1))
 return routes.map((route,index)=>({...route,number:numbers.get(route.id)||(Number(route.position)>0?Number(route.position):index+1)}))
}

async function resolveCoordinate(address:string|null|undefined,lat:number|null|undefined,lng:number|null|undefined){
 const known=asPoint(lat,lng)
 if(known)return known
 if(!address)return null
 try{return (await geocodeAddress(address))?.coordinate||null}catch{return null}
}

export default function OperationsMap({routes,locale='en',interactive=true,hideFooter=false,onSummary}:Props){
 const [resolved,setResolved]=useState<ResolvedRoute[]>([])
 const [sequences,setSequences]=useState<ResolvedSequence[]>([])
 const summaryRef=useRef(onSummary)
 const operationsDataRef=useRef([] as OperationsRoute[])
 summaryRef.current=onSummary

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
  const draft:Array<ResolvedSequence&{points:Coordinate[]}>=[...grouped.entries()].map(([key,groupRoutes],index)=>{
   const driverId=key==='unassigned'?null:key
   const remaining=groupRoutes.filter(route=>isRemaining(route.status)&&route.destination)
   const start=remaining[0]?.origin||groupRoutes[0]?.origin||null
   const points=[start,...remaining.map(route=>route.destination)].filter((point):point is Coordinate=>Boolean(point)).filter((point,index,list)=>index===0||point.lat!==list[index-1].lat||point.lng!==list[index-1].lng)
   return {key,driverId,routes:groupRoutes,start,line:points,color:sequenceColors[index%sequenceColors.length],points,distanceMeters:undefined,durationSeconds:undefined}
  })
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
   const ready:Array<ResolvedSequence&{points:Coordinate[]}>=[...nextGroups.entries()].map(([key,groupRoutes],index)=>{
    const driverId=key==='unassigned'?null:key
    const remaining=groupRoutes.filter(route=>isRemaining(route.status)&&route.destination)
    const start=remaining[0]?.origin||groupRoutes[0]?.origin||null
    const points=[start,...remaining.map(route=>route.destination)].filter((point):point is Coordinate=>Boolean(point)).filter((point,index,list)=>index===0||point.lat!==list[index-1].lat||point.lng!==list[index-1].lng)
    return {key,driverId,routes:groupRoutes,start,line:points,color:sequenceColors[index%sequenceColors.length],points,distanceMeters:undefined,durationSeconds:undefined}
   })
   setResolved(hydrated)
   setSequences(ready.map(({points: _points,...sequence})=>sequence))
   const built=await Promise.all(ready.map(async sequence=>{
    try{
     const estimate=sequence.points.length>1?await osrmRoute(sequence.points):null
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
 },[routeKey])

 const allPoints=useMemo(()=>{
  const operational=[
   ...sequences.map(sequence=>sequence.start),
   ...resolved.filter(route=>isRemaining(route.status)||route.status==='issue').map(route=>route.destination),
  ].filter((point):point is Coordinate=>Boolean(point))
  return operational.length?operational:resolved.map(route=>route.destination).filter((point):point is Coordinate=>Boolean(point))
 },[resolved,sequences])
 const fitPoints=useMemo(()=>{
  const remaining=resolved.filter(route=>isRemaining(route.status)).flatMap(route=>[route.origin,route.destination]).filter((point):point is Coordinate=>Boolean(point))
  if(remaining.length)return remaining
  const configured=resolved.flatMap(route=>[route.origin,route.destination]).filter((point):point is Coordinate=>Boolean(point))
  return configured
 },[resolved])
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
     {sequence.line.length>1&&<>
       <Polyline positions={sequence.line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#ffffff',weight:10,opacity:.92,lineCap:'round',lineJoin:'round'}}/>
       <Polyline positions={sequence.line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:sequence.color,weight:6,opacity:.96,lineCap:'round',lineJoin:'round',dashArray:sequence.street?undefined:'10 8'}}/>
      </>}
      {sequence.start&&<Marker position={[sequence.start.lat,sequence.start.lng]} icon={originMarker(sequence.color)}><Tooltip direction="top" offset={[0,-14]}>{copy.start}</Tooltip></Marker>}
    </Fragment>)}
    {resolved.filter(route=>isRemaining(route.status)).map(route=>route.destination&&<Marker key={`route-${route.id}`} position={[route.destination.lat,route.destination.lng]} icon={routeMarker(route.number,routeColor(route.status))} zIndexOffset={route.status==='active'||route.status==='paused'?500:300}>
     <Tooltip direction="top" offset={[0,-20]}>{`${route.number}. ${routeTypeLabel(route.mission_type,locale)} · ${route.destination_name||route.destination_address||copy.driver} · ${statusLabel(route.status,locale)}`}</Tooltip>
    </Marker>)}
    </MapContainer>
    {!hasOperationalInput&&<div className={styles.emptyOverlay}>{copy.unavailable}</div>}
    <div className={styles.legend} aria-label={copy.label}><span><i className={styles.current}/>{copy.current}</span><span><i className={styles.pending}/>{copy.pending}</span><span><i className={styles.completed}/>{copy.completed}</span><span><i className={styles.issue}/>{copy.issue}</span><span><Truck size={13}/>{visibleRoutes.length} {locale==='es'?'rutas':locale==='fr'?'itinéraires':'routes'}</span></div>
  </div>
  {!hideFooter&&<footer><span>{visibleRoutes.length} {locale==='es'?'rutas':locale==='fr'?'itinéraires':'routes'}</span><small>{locale==='es'?'Vista de rutas asignadas':locale==='fr'?'Vue des itinéraires attribués':'Assigned routes view'}</small></footer>}
 </section>
}
