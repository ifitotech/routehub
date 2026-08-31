'use client'

import {Fragment,useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,Popup,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {Truck} from 'lucide-react'
import {geocodeAddress} from '../lib/maps/geocoding'
import {isInFlorida,mapTileConfig} from '../lib/maps/map-config'
import {calculateRoute,distanceMeters} from '../lib/maps/routing'
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
const sequenceColors=['#1667F2','#7c3aed','#0f766e','#ea580c','#16a34a']
const isRemaining=(status?:string|null)=>status!=='completed'&&status!=='cancelled'
const MAX_SEGMENT_METERS=160_000
const asPoint=(lat:number|null|undefined,lng:number|null|undefined):Coordinate|null=>{
 const nextLat=Number(lat),nextLng=Number(lng)
 if(!Number.isFinite(nextLat)||!Number.isFinite(nextLng))return null
 if(isInFlorida(nextLat,nextLng)||distanceMeters({lat:nextLat,lng:nextLng},miamiCenter)<=MAX_SEGMENT_METERS)return {lat:nextLat,lng:nextLng}
 if(isInFlorida(nextLng,nextLat))return {lat:nextLng,lng:nextLat}
 return null
}
function usableSegment(from:Coordinate,to:Coordinate){
 return distanceMeters(from,to)<=MAX_SEGMENT_METERS
}
function sequenceLine(groupRoutes:ResolvedRoute[],driver?:OperationsDriverLocation){
 const remaining=groupRoutes.filter(route=>isRemaining(route.status)&&route.status!=='issue'&&route.destination)
 const finished=groupRoutes.filter(route=>route.status==='completed'&&route.destination)
 const path=remaining.length?remaining:finished
 const dests=path.map(route=>route.destination).filter((point):point is Coordinate=>Boolean(point))
 let start=driver?.location||path[0]?.origin||null
 if(start&&dests[0]&&!usableSegment(start,dests[0]))start=path[0]?.origin||dests[0]
 if(!start)start=path[0]?.origin||dests[0]||null
 const line=[start,...dests].filter((point):point is Coordinate=>Boolean(point)).filter((point,index,list)=>index===0||point.lat!==list[index-1].lat||point.lng!==list[index-1].lng)
 return {remaining,start,line,color:remaining.length?undefined:'#94a3b8'}
}

function routeColor(status?:string|null){
 if(status==='issue')return '#E11D48'
 if(status==='completed')return '#94a3b8'
 if(status==='active'||status==='paused')return '#1667F2'
 return '#F59E0B'
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
 return L.divIcon({className:'operations-route-marker-wrap',html:`<span class="operations-route-marker${completed?' is-completed':''}" style="--marker-color:${color}">${completed?'✓':number}</span>`,iconSize:[36,42],iconAnchor:[18,38]})
}

function originMarker(color:string){
 return L.divIcon({className:'operations-origin-marker-wrap',html:`<span class="operations-origin-marker" style="--marker-color:${color}"></span>`,iconSize:[24,24],iconAnchor:[12,12]})
}

function driverMarker(){
 return L.divIcon({className:'operations-driver-marker-wrap',html:'<span class="operations-driver-marker"><i></i></span>',iconSize:[48,48],iconAnchor:[24,24]})
}

function FitBounds({points}:{points:Coordinate[]}){
 const map=useMap()
 const key=points.map(point=>`${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join('|')
 useEffect(()=>{
  const id=window.requestAnimationFrame(()=>map.invalidateSize())
  if(!points.length){map.setView([miamiCenter.lat,miamiCenter.lng],12);return ()=>window.cancelAnimationFrame(id)}
  if(points.length===1){map.setView([points[0].lat,points[0].lng],14);return ()=>window.cancelAnimationFrame(id)}
  map.fitBounds(points.map(point=>[point.lat,point.lng] as [number,number]),{padding:[40,40],maxZoom:14})
  return ()=>window.cancelAnimationFrame(id)
 },[map,key,points])
 return null
}

function sortRoutes(routes:OperationsRoute[]){
 return routes.slice().sort((a,b)=>Number(a.position||Number.MAX_SAFE_INTEGER)-Number(b.position||Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id))
}

function withNumbers(routes:Array<OperationsRoute&{origin:Coordinate|null;destination:Coordinate|null}>):ResolvedRoute[]{
 const remaining=routes.filter(route=>isRemaining(route.status)&&route.status!=='issue'&&route.destination)
 const numbers=new Map<string,number>()
 remaining.forEach((route,index)=>numbers.set(route.id,index+1))
 return routes.map((route,index)=>({...route,number:numbers.get(route.id)||(Number(route.position)>0?Number(route.position):index+1)}))
}

async function resolveCoordinate(address:string|null|undefined,lat:number|null|undefined,lng:number|null|undefined){
 const known=asPoint(lat,lng)
 if(known)return known
 if(!address)return null
 try{
  const found=await geocodeAddress(address)
  const point=asPoint(found?.coordinate?.lat,found?.coordinate?.lng)
  if(point)return point
  const retry=await geocodeAddress(`${address}, Florida`)
  return asPoint(retry?.coordinate?.lat,retry?.coordinate?.lng)
 }catch{return null}
}

async function buildStreetLine(points:Coordinate[]){
 const safe=points
 if(safe.length<2)return {line:safe,street:false,distanceMeters:undefined as number|undefined,durationSeconds:undefined as number|undefined}
 const full=await calculateRoute(safe)
 if(full.source==='osrm'&&full.coordinates.length>safe.length){
  return {line:full.coordinates,street:true,distanceMeters:full.distanceMeters,durationSeconds:full.durationSeconds}
 }
 const segments:Coordinate[]=[]
 let meters=0
 let seconds=0
 let street=false
 for(let index=0;index<safe.length-1;index+=1){
  if(!usableSegment(safe[index],safe[index+1]))continue
  const estimate=await calculateRoute([safe[index],safe[index+1]])
  const good=estimate.source==='osrm'&&estimate.coordinates.length>2
  const chunk=good?estimate.coordinates:[safe[index],safe[index+1]]
  if(good)street=true
  if(!segments.length)segments.push(...chunk)
  else segments.push(...chunk.slice(1))
  meters+=(estimate.distanceMeters||distanceMeters(safe[index],safe[index+1]))
  seconds+=(estimate.durationSeconds||0)
 }
 return {
  line:segments.length>1?segments:safe,
  street,
  distanceMeters:meters||undefined,
  durationSeconds:seconds||undefined,
 }
}

export default function OperationsMap({routes,driverLocations=[],locale='en',interactive=true,hideFooter=false,onSummary}:Props){
 const [resolved,setResolved]=useState<ResolvedRoute[]>([])
 const [sequences,setSequences]=useState<ResolvedSequence[]>([])
 const summaryRef=useRef(onSummary)
 summaryRef.current=onSummary

 const visibleRoutes=useMemo(()=>sortRoutes(routes.filter(route=>route.origin_address||route.destination_address||asPoint(route.origin_lat,route.origin_lng)||asPoint(route.destination_lat,route.destination_lng))),[routes])
 const routeKey=visibleRoutes.map(route=>[route.id,route.mission_type,route.origin_address,route.destination_address,route.origin_lat,route.origin_lng,route.destination_lat,route.destination_lng,route.status,route.driver_id,route.position].join(':')).join('|')
 const driverKey=driverLocations.map(driver=>[driver.id,driver.driver_id,driver.location.lat,driver.location.lng,driver.status,driver.updatedAt].join(':')).join('|')

 useEffect(()=>{
  let cancelled=false
  const instant=withNumbers(visibleRoutes.map(route=>({
   ...route,
   origin:asPoint(route.origin_lat,route.origin_lng),
   destination:asPoint(route.destination_lat,route.destination_lng),
  })))
  const grouped=new Map<string,ResolvedRoute[]>()
  for(const route of instant){
   const key=route.driver_id||'unassigned'
   grouped.set(key,[...(grouped.get(key)||[]),route])
  }
  const draft:ResolvedSequence[]=[...grouped.entries()].map(([key,groupRoutes],index)=>{
   const driverId=key==='unassigned'?null:key
   const driver=driverId?driverLocations.find(item=>item.driver_id===driverId&&item.status!=='unavailable'):undefined
   const built=sequenceLine(groupRoutes,driver)
   return {key,driverId,routes:groupRoutes,start:built.start,line:built.line,color:built.color||sequenceColors[index%sequenceColors.length],street:false}
  })
  setResolved(instant)
  setSequences(draft)
  summaryRef.current?.({count:draft.reduce((total,sequence)=>total+sequence.routes.filter(route=>isRemaining(route.status)&&route.status!=='issue').length,0)})

  void (async()=>{
   const hydrated=withNumbers(await Promise.all(visibleRoutes.map(async route=>{
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
   const ready:ResolvedSequence[]=[...nextGroups.entries()].map(([key,groupRoutes],index)=>{
    const driverId=key==='unassigned'?null:key
    const driver=driverId?driverLocations.find(item=>item.driver_id===driverId&&item.status!=='unavailable'):undefined
    const built=sequenceLine(groupRoutes,driver)
    return {key,driverId,routes:groupRoutes,start:built.start,line:built.line,color:built.color||sequenceColors[index%sequenceColors.length],street:false}
   })
   setResolved(hydrated)
   setSequences(ready)
   const built=await Promise.all(ready.map(async sequence=>{
    const estimate=await buildStreetLine(sequence.line)
    return {...sequence,...estimate}
   }))
   if(cancelled)return
   setSequences(built)
   summaryRef.current?.({
    count:built.reduce((total,sequence)=>total+sequence.routes.filter(route=>isRemaining(route.status)&&route.status!=='issue').length,0),
    distanceMeters:built.some(sequence=>Number.isFinite(sequence.distanceMeters))?built.reduce((total,sequence)=>total+(sequence.distanceMeters||0),0):undefined,
    durationSeconds:built.some(sequence=>Number.isFinite(sequence.durationSeconds))?built.reduce((total,sequence)=>total+(sequence.durationSeconds||0),0):undefined,
   })
  })()
  return()=>{cancelled=true}
 },[routeKey,driverKey])

 const allPoints=useMemo(()=>{
  const operational=[
   ...resolved.map(route=>route.destination),
   ...resolved.map(route=>route.origin),
   ...driverLocations.map(driver=>driver.location),
  ].filter((point):point is Coordinate=>Boolean(point))
  return operational.length?operational:resolved.map(route=>route.destination).filter((point):point is Coordinate=>Boolean(point))
 },[driverLocations,resolved,sequences])
 const center=allPoints[0]||miamiCenter
 const copy=locale==='es'
  ?{label:'Mapa operativo',unavailable:'Asigna una parada con dirección para verla aquí.',current:'En curso',pending:'Pendiente',completed:'Completada',issue:'Incidencia',driver:'Conductor',start:'Inicio'}
  :locale==='fr'
   ?{label:'Carte opérationnelle',unavailable:'Ajoutez un arrêt avec adresse pour l’afficher ici.',current:'En cours',pending:'En attente',completed:'Terminé',issue:'Incident',driver:'Conducteur',start:'Départ'}
   :{label:'Operations map',unavailable:'Add a stop with an address to see it here.',current:'In progress',pending:'Pending',completed:'Completed',issue:'Issue',driver:'Driver',start:'Start'}

 return <section className={styles.map} aria-label={copy.label}>
  <div className={styles.canvas}>
   <MapContainer center={[center.lat,center.lng]} zoom={12} scrollWheelZoom={interactive} dragging={interactive} touchZoom={interactive} doubleClickZoom={interactive} zoomControl={interactive}>
    <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
    <FitBounds points={allPoints}/>
    {sequences.map(sequence=>sequence.line.length>1&&<Fragment key={`line-${sequence.key}`}>
     <Polyline positions={sequence.line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#ffffff',weight:sequence.street?11:7,opacity:.95,lineCap:'round',lineJoin:'round'}}/>
     <Polyline positions={sequence.line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:sequence.color,weight:sequence.street?7:4,opacity:sequence.street?0.96:0.78,dashArray:sequence.street?undefined:'10 8',lineCap:'round',lineJoin:'round'}}/>
    </Fragment>)}
    {sequences.map(sequence=>sequence.start&&!driverLocations.some(driver=>driver.driver_id===sequence.driverId)&&<Marker key={`start-${sequence.key}`} position={[sequence.start.lat,sequence.start.lng]} icon={originMarker(sequence.color)}><Tooltip direction="top" offset={[0,-12]}>{copy.start}</Tooltip></Marker>)}
    {resolved.map(route=>route.destination&&<Marker key={route.id} position={[route.destination.lat,route.destination.lng]} icon={routeMarker(route.number,routeColor(route.status),route.status==='completed')} zIndexOffset={route.status==='active'||route.status==='paused'?600:route.status==='completed'?80:300}>
     <Tooltip direction="top" offset={[0,-20]}>{`${route.number}. ${routeTypeLabel(route.mission_type,locale)} · ${route.destination_name||route.destination_address||copy.driver}`}</Tooltip>
    </Marker>)}
    {driverLocations.map(driver=><Marker key={driver.id} position={[driver.location.lat,driver.location.lng]} icon={driverMarker()} zIndexOffset={1200}>
     <Tooltip direction="top" offset={[0,-22]} permanent>{driver.label||copy.driver}{driver.nextStop?` · ${driver.nextStop}`:''}</Tooltip>
     <Popup><strong>{driver.label||copy.driver}</strong><br/><small>{statusLabel(driver.status,locale)}</small></Popup>
    </Marker>)}
   </MapContainer>
   {!resolved.length&&!driverLocations.length&&<div className={styles.state}>{copy.unavailable}</div>}
   <div className={styles.legend}><span><i className={styles.current}/>{copy.current}</span><span><i className={styles.pending}/>{copy.pending}</span><span><i className={styles.completed}/>{copy.completed}</span><span><i className={styles.issue}/>{copy.issue}</span><span><Truck size={13}/>{driverLocations.length} {copy.driver.toLowerCase()}{driverLocations.length===1?'':'s'}</span></div>
  </div>
  {!hideFooter&&<footer><span>{visibleRoutes.length} {locale==='es'?'rutas':locale==='fr'?'itinéraires':'routes'}</span><small>{driverLocations.length?`${driverLocations.length} ${copy.driver.toLowerCase()}${driverLocations.length===1?'':'s'}`:(locale==='es'?'Sin GPS activo':locale==='fr'?'Pas de GPS actif':'No live GPS')}</small></footer>}
 </section>
}
