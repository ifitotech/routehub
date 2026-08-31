'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
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

type Stop=OperationsRoute&{destination:Coordinate|null;number:number}
type Props={
 routes:OperationsRoute[]
 driverLocations?:OperationsDriverLocation[]
 locale?:string
 interactive?:boolean
 hideFooter?:boolean
 onSummary?:(summary:{count:number;distanceMeters?:number;durationSeconds?:number}|null)=>void
}

const miami:Coordinate={lat:25.857,lng:-80.278}
const isPoint=(lat:number|null|undefined,lng:number|null|undefined):Coordinate|null=>{
 const nextLat=Number(lat),nextLng=Number(lng)
 return Number.isFinite(nextLat)&&Number.isFinite(nextLng)?{lat:nextLat,lng:nextLng}:null
}
const openStatus=(status?:string|null)=>status!=='completed'&&status!=='cancelled'&&status!=='issue'

function colorFor(status?:string|null){
 if(status==='issue')return '#E11D48'
 if(status==='completed')return '#94a3b8'
 if(status==='active'||status==='paused')return '#1667F2'
 return '#F59E0B'
}

function typeLabel(type:string|null|undefined,locale:string){
 if(locale==='es')return type==='pickup'?'Recogida':type==='delivery'?'Entrega':type==='return'?'Regreso':'Parada'
 if(locale==='fr')return type==='pickup'?'Collecte':type==='delivery'?'Livraison':type==='return'?'Retour':'Arrêt'
 return type==='pickup'?'Pickup':type==='delivery'?'Delivery':type==='return'?'Return':'Stop'
}

function pin(number:number,color:string,done=false){
 return L.divIcon({className:'operations-route-marker-wrap',html:`<span class="operations-route-marker${done?' is-completed':''}" style="--marker-color:${color}">${done?'✓':number}</span>`,iconSize:[36,42],iconAnchor:[18,38]})
}

function carPin(){
 return L.divIcon({className:'operations-driver-marker-wrap',html:'<span class="operations-driver-marker"><i></i></span>',iconSize:[48,48],iconAnchor:[24,24]})
}

function Fit({points}:{points:Coordinate[]}){
 const map=useMap()
 const key=points.map(point=>`${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join('|')
 useEffect(()=>{
  const frame=window.requestAnimationFrame(()=>map.invalidateSize())
  if(!points.length)map.setView([miami.lat,miami.lng],12)
  else if(points.length===1)map.setView([points[0].lat,points[0].lng],13)
  else map.fitBounds(points.map(point=>[point.lat,point.lng] as [number,number]),{padding:[36,36],maxZoom:14})
  return()=>window.cancelAnimationFrame(frame)
 },[map,key,points])
 return null
}

async function locate(address:string|null|undefined,lat:number|null|undefined,lng:number|null|undefined){
 const known=isPoint(lat,lng)
 if(known)return known
 if(!address)return null
 try{return (await geocodeAddress(address))?.coordinate||null}catch{return null}
}

export default function OperationsMap({routes,driverLocations=[],locale='en',interactive=true,hideFooter=false,onSummary}:Props){
 const [stops,setStops]=useState<Stop[]>([])
 const [line,setLine]=useState<Coordinate[]>([])
 const summaryRef=useRef(onSummary)
 summaryRef.current=onSummary

 const ordered=useMemo(()=>routes.slice().sort((a,b)=>Number(a.position||0)-Number(b.position||0)||a.id.localeCompare(b.id)),[routes])
 const routeKey=ordered.map(route=>[route.id,route.status,route.position,route.destination_lat,route.destination_lng,route.destination_address,route.origin_lat,route.origin_lng,route.driver_id].join(':')).join('|')
 const driver=driverLocations.find(item=>Number.isFinite(item.location.lat)&&Number.isFinite(item.location.lng))
 const driverKey=driver?`${driver.driver_id}:${driver.location.lat}:${driver.location.lng}`:''

 useEffect(()=>{
  let cancelled=false
  const instant:Stop[]=ordered.map((route,index)=>({
   ...route,
   destination:isPoint(route.destination_lat,route.destination_lng),
   number:index+1,
  }))
  const open=instant.filter(route=>openStatus(route.status)&&route.destination)
  const start=driver?.location||isPoint(ordered[0]?.origin_lat,ordered[0]?.origin_lng)
  const firstLine=[start,...(open.length?open:instant.filter(route=>route.destination)).map(route=>route.destination)].filter((point):point is Coordinate=>Boolean(point))
  setStops(instant)
  setLine(firstLine)
  summaryRef.current?.({count:open.length})

  void (async()=>{
   const resolved:Stop[]=[]
   for(const [index,route] of ordered.entries()){
    const destination=await locate(route.destination_address,route.destination_lat,route.destination_lng)
    resolved.push({...route,destination,number:index+1})
   }
   if(cancelled)return
   const numbered=resolved.map((route,index,list)=>{
    const pending=list.filter(item=>openStatus(item.status)&&item.destination)
    const number=pending.findIndex(item=>item.id===route.id)
    return {...route,number:number>=0?number+1:index+1}
   })
   const pending=numbered.filter(route=>openStatus(route.status)&&route.destination)
   const visible=pending.length?pending:numbered.filter(route=>route.destination)
   const origin=driver?.location||await locate(ordered[0]?.origin_address,ordered[0]?.origin_lat,ordered[0]?.origin_lng)
   const waypoints=[origin,...visible.map(route=>route.destination)].filter((point):point is Coordinate=>Boolean(point)).filter((point,index,list)=>index===0||point.lat!==list[index-1].lat||point.lng!==list[index-1].lng)
   setStops(numbered)
   setLine(waypoints)
   if(waypoints.length>1){
    const estimate=await calculateRoute(waypoints)
    if(cancelled)return
    if(estimate.coordinates.length>1)setLine(estimate.coordinates)
    summaryRef.current?.({count:pending.length,distanceMeters:estimate.distanceMeters,durationSeconds:estimate.durationSeconds})
   }else{
    summaryRef.current?.({count:pending.length})
   }
  })()
  return()=>{cancelled=true}
 },[routeKey,driverKey])

 const bounds=[...line.slice(0,1),...stops.map(route=>route.destination),driver?.location].filter((point):point is Coordinate=>Boolean(point))
 const copy=locale==='es'
  ?{label:'Mapa operativo',empty:'No hay paradas con dirección hoy.',driver:'Conductor'}
  :locale==='fr'
   ?{label:'Carte opérationnelle',empty:'Aucun arrêt avec adresse aujourd’hui.',driver:'Conducteur'}
   :{label:'Operations map',empty:'No stops with an address today.',driver:'Driver'}

 return <section className={styles.map} aria-label={copy.label}>
  <div className={styles.canvas}>
   <MapContainer center={[miami.lat,miami.lng]} zoom={12} scrollWheelZoom={interactive} dragging={interactive} touchZoom={interactive} doubleClickZoom={interactive} zoomControl={interactive}>
    <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
    <Fit points={bounds.length?bounds:[miami]}/>
    {line.length>1&&<>
     <Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#ffffff',weight:10,opacity:1,lineCap:'round',lineJoin:'round'}}/>
     <Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#1667F2',weight:6,opacity:1,lineCap:'round',lineJoin:'round'}}/>
    </>}
    {stops.map(route=>route.destination&&<Marker key={route.id} position={[route.destination.lat,route.destination.lng]} icon={pin(route.number,colorFor(route.status),route.status==='completed')} zIndexOffset={openStatus(route.status)?400:80}>
     <Tooltip direction="top" offset={[0,-18]}>{`${route.number}. ${typeLabel(route.mission_type,locale)} · ${route.destination_name||route.destination_address||copy.driver}`}</Tooltip>
    </Marker>)}
    {driver&&<Marker position={[driver.location.lat,driver.location.lng]} icon={carPin()} zIndexOffset={1000}>
     <Tooltip direction="top" offset={[0,-20]} permanent>{driver.label||copy.driver}{driver.nextStop?` · ${driver.nextStop}`:''}</Tooltip>
    </Marker>}
   </MapContainer>
   {!stops.length&&!driver&&<div className={styles.state}>{copy.empty}</div>}
  </div>
  {!hideFooter&&<footer><span>{stops.length} {locale==='es'?'rutas':locale==='fr'?'itinéraires':'routes'}</span><small>{line.length>1?(locale==='es'?'Recorrido listo':locale==='fr'?'Trajet prêt':'Route ready'):(locale==='es'?'Sin recorrido':locale==='fr'?'Pas de trajet':'No path yet')}</small></footer>}
 </section>
}
