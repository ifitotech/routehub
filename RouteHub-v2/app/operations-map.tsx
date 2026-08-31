'use client'

import {Fragment,useEffect,useMemo,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,Popup,useMap} from 'react-leaflet'
import {Truck} from 'lucide-react'
import {geocodeAddress} from '../lib/maps/geocoding'
import {mapTileConfig} from '../lib/maps/map-config'
import {calculateRoute} from '../lib/maps/routing'
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
type ResolvedSequence={key:string;driverId:string|null;routes:ResolvedRoute[];start:Coordinate|null;line:Coordinate[];color:string;distanceMeters?:number;durationSeconds?:number}
type Props={routes:OperationsRoute[];driverLocations?:OperationsDriverLocation[];locale?:string;interactive?:boolean;onSummary?:(summary:{count:number;distanceMeters?:number;durationSeconds?:number}|null)=>void}

const fallbackCenter:Coordinate={lat:39.8283,lng:-98.5795}
const isCoordinate=(lat:number|null|undefined,lng:number|null|undefined):lat is number=>lat!=null&&lng!=null&&Number.isFinite(lat)&&Number.isFinite(lng)

function routeColor(status?:string|null){
 if(status==='issue')return '#dc2626'
 if(status==='completed')return '#94a3b8'
 if(status==='active'||status==='paused')return '#2563eb'
 return '#f59e0b'
}

const sequenceColors=['#2563eb','#7c3aed','#0891b2','#ea580c','#16a34a']
const isRemaining=(status?:string|null)=>status!=='completed'&&status!=='cancelled'

function routeTypeLabel(type:string|null|undefined,locale:string){
 if(locale==='es')return type==='pickup'?'Recogida':type==='delivery'?'Entrega':type==='return'?'Retorno':'Parada'
 if(locale==='fr')return type==='pickup'?'Collecte':type==='delivery'?'Livraison':type==='return'?'Retour':'Arrêt'
 return type==='pickup'?'Pickup':type==='delivery'?'Delivery':type==='return'?'Return':'Stop'
}

function statusLabel(status:string|undefined|null,locale:string){
 if(locale==='es')return status==='issue'?'Incidencia':status==='completed'?'Completada':status==='active'||status==='paused'?'Ruta actual':'Pendiente'
 if(locale==='fr')return status==='issue'?'Incident':status==='completed'?'Terminé':status==='active'||status==='paused'?'Itinéraire actuel':'En attente'
 return status==='issue'?'Issue':status==='completed'?'Completed':status==='active'||status==='paused'?'Current route':'Pending'
}

function routeMarker(number:number,color:string,completed=false){
 return L.divIcon({className:'operations-route-marker-wrap',html:`<span class="operations-route-marker${completed?' is-completed':''}" style="--marker-color:${color}">${completed?'✓':number}</span>`,iconSize:[36,42],iconAnchor:[18,38]})
}

function originMarker(color:string){
 return L.divIcon({className:'operations-origin-marker-wrap',html:`<span class="operations-origin-marker" style="--marker-color:${color}">S</span>`,iconSize:[24,24],iconAnchor:[12,12]})
}

function driverMarker(){
 return L.divIcon({className:'operations-driver-marker-wrap',html:'<span class="operations-driver-marker"><i></i></span>',iconSize:[48,48],iconAnchor:[24,24]})
}

function ageLabel(updatedAt:string|null|undefined,locale:string){
 if(!updatedAt)return locale==='es'?'Sin actualización':locale==='fr'?'Aucune mise à jour':'No update'
 const age=Math.max(0,Date.now()-new Date(updatedAt).getTime())
 if(!Number.isFinite(age))return locale==='es'?'Sin actualización':locale==='fr'?'Aucune mise à jour':'No update'
 const minutes=Math.floor(age/60000)
 if(minutes<1)return locale==='es'?'Actualizado ahora':locale==='fr'?'Mis à jour à l’instant':'Updated just now'
 if(minutes<60)return locale==='es'?`Actualizado hace ${minutes} min`:locale==='fr'?`Mis à jour il y a ${minutes} min`:`Updated ${minutes} min ago`
 const hours=Math.floor(minutes/60)
 return locale==='es'?`Última actualización hace ${hours} h`:locale==='fr'?`Dernière mise à jour il y a ${hours} h`:`Last updated ${hours} hr ago`
}

function FitBounds({points}:{points:Coordinate[]}){
 const map=useMap()
 const pointKey=points.map(point=>`${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|')
 useEffect(()=>{
  if(!points.length)return
  if(points.length===1){map.setView([points[0].lat,points[0].lng],14);return}
  map.fitBounds(points.map(point=>[point.lat,point.lng] as [number,number]),{padding:[32,32],maxZoom:15})
 },[map,pointKey])
 return null
}

async function resolveCoordinate(address:string|null|undefined,lat:number|null|undefined,lng:number|null|undefined){
 if(isCoordinate(lat,lng))return {lat:Number(lat),lng:Number(lng)}
 if(!address)return null
 try{return (await geocodeAddress(address))?.coordinate||null}catch{return null}
}

export default function OperationsMap({routes,driverLocations=[],locale='en',interactive=true,onSummary}:Props){
 const [resolved,setResolved]=useState<ResolvedRoute[]>([])
 const [sequences,setSequences]=useState<ResolvedSequence[]>([])
 const [loading,setLoading]=useState(true)
 const visibleRoutes=useMemo(()=>routes.filter(route=>route.origin_address||route.destination_address||isCoordinate(route.origin_lat,route.origin_lng)||isCoordinate(route.destination_lat,route.destination_lng)),[routes])
 const routeKey=visibleRoutes.map(route=>[route.id,route.mission_type,route.origin_address,route.destination_address,route.origin_lat,route.origin_lng,route.destination_lat,route.destination_lng,route.status,route.driver_id,route.position].join(':')).join('|')
 const driverKey=driverLocations.map(driver=>[driver.id,driver.driver_id,driver.location.lat,driver.location.lng,driver.status,driver.updatedAt].join(':')).join('|')

 useEffect(()=>{
  let cancelled=false
  setLoading(true)
  void Promise.all(visibleRoutes.map(async route=>{
   const [origin,destination]=await Promise.all([
    resolveCoordinate(route.origin_address,route.origin_lat,route.origin_lng),
    resolveCoordinate(route.destination_address,route.destination_lat,route.destination_lng),
   ])
   return {...route,origin,destination,number:0}
  })).then(async next=>{
   const sorted=next.sort((a,b)=>Number(a.position||Number.MAX_SAFE_INTEGER)-Number(b.position||Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id))
   const numbered=sorted.map((route,index)=>({...route,number:Number(route.position)>0?Number(route.position):index+1}))
   const grouped=new Map<string,ResolvedRoute[]>()
   for(const route of numbered){const key=route.driver_id||'unassigned';grouped.set(key,[...(grouped.get(key)||[]),route])}
   const draft=[...grouped.entries()].map(([key,groupRoutes],index)=>{
    const driverId=key==='unassigned'?null:key
    const driver=driverId?driverLocations.find(item=>item.driver_id===driverId&&item.status!=='unavailable'):undefined
    const remaining=groupRoutes.filter(route=>isRemaining(route.status)&&route.destination)
    const start=driver?.location||remaining[0]?.origin||groupRoutes[0]?.origin||null
    const points=[start,...remaining.map(route=>route.destination)].filter((point):point is Coordinate=>Boolean(point)).filter((point,index,list)=>index===0||point.lat!==list[index-1].lat||point.lng!==list[index-1].lng)
    return {key,driverId,routes:groupRoutes,start,line:points,color:sequenceColors[index%sequenceColors.length],points,distanceMeters:undefined as number|undefined,durationSeconds:undefined as number|undefined}
   })
   if(!cancelled){
    setResolved(numbered)
    setSequences(draft.map(({points,...sequence})=>sequence))
    setLoading(false)
    onSummary?.({count:draft.reduce((total,sequence)=>total+sequence.routes.filter(route=>isRemaining(route.status)).length,0)})
   }
   const built=await Promise.all(draft.map(async sequence=>{
    try{
     const estimate=sequence.points.length>1?await calculateRoute(sequence.points):null
     const routed=estimate?.coordinates
     return {...sequence,line:routed&&routed.length>1?routed:sequence.points,distanceMeters:estimate?.distanceMeters,durationSeconds:estimate?.durationSeconds}
    }catch{
     return {...sequence,distanceMeters:undefined,durationSeconds:undefined}
    }
   }))
   if(!cancelled){
    setSequences(built.map(({points,...sequence})=>sequence))
    onSummary?.({count:built.reduce((total,sequence)=>total+sequence.routes.filter(route=>isRemaining(route.status)).length,0),distanceMeters:built.some(sequence=>Number.isFinite(sequence.distanceMeters))?built.reduce((total,sequence)=>total+(sequence.distanceMeters||0),0):undefined,durationSeconds:built.some(sequence=>Number.isFinite(sequence.durationSeconds))?built.reduce((total,sequence)=>total+(sequence.durationSeconds||0),0):undefined})
   }
  }).catch(()=>{if(!cancelled)setLoading(false)}).finally(()=>{if(!cancelled)setLoading(false)})
  return()=>{cancelled=true}
 },[routeKey,driverKey,onSummary])

 const allPoints=useMemo(()=>{
  const operational=[...sequences.map(sequence=>sequence.start),...resolved.filter(route=>isRemaining(route.status)).map(route=>route.destination),...driverLocations.map(driver=>driver.location)].filter((point):point is Coordinate=>Boolean(point))
  return operational.length?operational:resolved.map(route=>route.destination).filter((point):point is Coordinate=>Boolean(point))
 },[driverLocations,resolved,sequences])
 const center=allPoints[0]||fallbackCenter
 const copy=locale==='es'
  ?{label:'Mapa operativo de rutas',loading:'Preparando mapa operativo…',unavailable:'No hay rutas activas ni conductores compartiendo ubicación.',current:'Ruta en carretera',pending:'Pendiente',completed:'Completada',issue:'Incidencia',driver:'Conductor',start:'Inicio'}
  :locale==='fr'
   ?{label:'Carte opérationnelle des itinéraires',loading:'Préparation de la carte opérationnelle…',unavailable:'Aucun itinéraire actif ni conducteur ne partage sa position.',current:'Itinéraire routier',pending:'En attente',completed:'Terminé',issue:'Incident',driver:'Conducteur',start:'Départ'}
   :{label:'Route operations map',loading:'Preparing operations map…',unavailable:'No active routes or drivers are sharing location.',current:'Road route',pending:'Pending',completed:'Completed',issue:'Issue',driver:'Driver',start:'Start'}

 return <section className={styles.map} aria-label={copy.label}>
  <div className={styles.canvas}>
   {loading?<div className={styles.state}>{copy.loading}</div>:!resolved.length&&!driverLocations.length?<div className={styles.state}>{copy.unavailable}</div>:<MapContainer center={[center.lat,center.lng]} zoom={11} scrollWheelZoom={false} dragging={interactive} touchZoom={interactive} doubleClickZoom={interactive} zoomControl={interactive}>
    <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
    <FitBounds points={allPoints}/>
    {sequences.map(sequence=><Fragment key={`sequence-${sequence.key}`}>
     {sequence.line.length>1&&<><Polyline positions={sequence.line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#ffffff',weight:10,opacity:.9,lineCap:'round',lineJoin:'round'}}/><Polyline positions={sequence.line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:sequence.color,weight:6,opacity:.96,lineCap:'round',lineJoin:'round'}}/></>}
     {sequence.start&&!driverLocations.some(driver=>driver.driver_id===sequence.driverId&&driver.status!=='unavailable')&&<Marker position={[sequence.start.lat,sequence.start.lng]} icon={originMarker(sequence.color)}><Tooltip direction="top" offset={[0,-14]}>{copy.start}</Tooltip></Marker>}
    </Fragment>)}
    {resolved.map(route=>route.destination&&<Marker key={`route-${route.id}`} position={[route.destination.lat,route.destination.lng]} icon={routeMarker(route.number,routeColor(route.status),route.status==='completed')} zIndexOffset={route.status==='completed'?100:300}><Tooltip direction="top" offset={[0,-20]}>{`${route.number}. ${routeTypeLabel(route.mission_type,locale)} · ${route.destination_name||route.destination_address||copy.driver} · ${statusLabel(route.status,locale)}`}</Tooltip></Marker>)}
    {driverLocations.map(driver=><Fragment key={driver.id}>
      <Marker position={[driver.location.lat,driver.location.lng]} icon={driverMarker()} zIndexOffset={1000}>
       <Tooltip direction="top" offset={[0,-22]} permanent>{driver.label||copy.driver}{driver.nextStop?` · ${driver.nextStop}`:''}</Tooltip>
       <Popup><strong>{driver.label||copy.driver}</strong><br/><span>{driver.status==='on_route'?'On route':driver.status==='available'?'Available':driver.status==='unavailable'?'Location unavailable':'Driving'}</span><br/><small>{ageLabel(driver.updatedAt,locale)}</small>{driver.nextStop&&<><br/><small>{driver.nextStop}</small></>}</Popup>
      </Marker>
    </Fragment>)}
   </MapContainer>}
   <div className={styles.legend} aria-label={copy.label}><span><i className={styles.current}/>{copy.current}</span><span><i className={styles.pending}/>{copy.pending}</span><span><i className={styles.completed}/>{copy.completed}</span><span><i className={styles.issue}/>{copy.issue}</span><span><Truck size={13}/>{driverLocations.length} {copy.driver.toLowerCase()}{driverLocations.length===1?'':'s'}</span></div>
  </div>
  <footer><span>{routes.length} {locale==='es'?'rutas configuradas':locale==='fr'?'itinéraires configurés':'configured routes'}</span><small>{driverLocations.length?`${driverLocations.length} ${copy.driver.toLowerCase()}${driverLocations.length===1?'':'s'} · ${locale==='es'?'ubicación actualizada':locale==='fr'?'position actualisée':'location updated'}`:(locale==='es'?'Sin ubicación activa':locale==='fr'?'Aucune position active':'No active location')}</small></footer>
 </section>
}
