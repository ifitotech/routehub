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
 order_number?:string|null
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

type ResolvedRoute=OperationsRoute&{points:Coordinate[];line:Coordinate[];number:number}
type Props={routes:OperationsRoute[];driverLocations?:OperationsDriverLocation[];locale?:string;interactive?:boolean}

const fallbackCenter:Coordinate={lat:39.8283,lng:-98.5795}
const isCoordinate=(lat:number|null|undefined,lng:number|null|undefined):lat is number=>lat!=null&&lng!=null&&Number.isFinite(lat)&&Number.isFinite(lng)

function routeColor(status?:string|null){
 if(status==='issue')return '#dc2626'
 if(status==='completed')return '#16a34a'
 if(status==='active'||status==='paused')return '#16a34a'
 return '#eab308'
}

function statusLabel(status:string|undefined|null,locale:string){
 if(locale==='es')return status==='issue'?'Incidencia':status==='completed'?'Completada':status==='active'||status==='paused'?'Ruta actual':'Pendiente'
 if(locale==='fr')return status==='issue'?'Incident':status==='completed'?'Terminé':status==='active'||status==='paused'?'Itinéraire actuel':'En attente'
 return status==='issue'?'Issue':status==='completed'?'Completed':status==='active'||status==='paused'?'Current route':'Pending'
}

function routeMarker(number:number,color:string){
 return L.divIcon({className:'operations-route-marker-wrap',html:`<span class="operations-route-marker" style="--marker-color:${color}">${number}</span>`,iconSize:[34,34],iconAnchor:[17,17]})
}

function originMarker(color:string){
 return L.divIcon({className:'operations-origin-marker-wrap',html:`<span class="operations-origin-marker" style="--marker-color:${color}">S</span>`,iconSize:[24,24],iconAnchor:[12,12]})
}

function driverMarker(){
 return L.divIcon({className:'operations-driver-marker-wrap',html:'<span class="operations-driver-marker"></span>',iconSize:[44,44],iconAnchor:[22,22]})
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

async function withTimeout<T>(task:Promise<T>,ms:number,fallback:T){
 try{
  return await Promise.race([task,new Promise<T>(resolve=>setTimeout(()=>resolve(fallback),ms))])
 }catch{return fallback}
}

async function resolveCoordinate(address:string|null|undefined,lat:number|null|undefined,lng:number|null|undefined){
 if(isCoordinate(lat,lng))return {lat,lng}
 if(!address)return null
 try{return (await withTimeout(geocodeAddress(address).then(value=>value?.coordinate||null),3500,null))}catch{return null}
}

export default function OperationsMap({routes,driverLocations=[],locale='en',interactive=true}:Props){
 const [resolved,setResolved]=useState<ResolvedRoute[]>([])
 const [loading,setLoading]=useState(true)
 const visibleRoutes=useMemo(()=>routes.filter(route=>route.origin_address||route.destination_address||isCoordinate(route.origin_lat,route.origin_lng)||isCoordinate(route.destination_lat,route.destination_lng)),[routes])
 const routeKey=visibleRoutes.map(route=>[route.id,route.origin_address,route.destination_address,route.origin_lat,route.origin_lng,route.destination_lat,route.destination_lng,route.status,route.position].join(':')).join('|')

 useEffect(()=>{
  let cancelled=false
  if(!visibleRoutes.length){
   setResolved([])
   setLoading(false)
   return
  }
  setLoading(true)
  void (async()=>{
   const pins=await Promise.all(visibleRoutes.map(async(route,index)=>{
    const [origin,destination]=await Promise.all([
     resolveCoordinate(route.origin_address,route.origin_lat,route.origin_lng),
     resolveCoordinate(route.destination_address,route.destination_lat,route.destination_lng),
    ])
    const points=[origin,destination].filter((point):point is Coordinate=>Boolean(point))
    return {...route,points,line:points,number:index+1}
   }))
   if(cancelled)return
   setResolved(pins)
   setLoading(false)
   const lined=await Promise.all(pins.map(async route=>{
    if(route.points.length<2)return route
    const estimate=await withTimeout(calculateRoute(route.points),4000,{coordinates:route.points,source:'fallback' as const})
    return {...route,line:estimate.coordinates.length>1?estimate.coordinates:route.points}
   }))
   if(!cancelled)setResolved(lined)
  })().catch(()=>{if(!cancelled){setResolved([]);setLoading(false)}})
  return()=>{cancelled=true}
 },[routeKey])

 const allPoints=useMemo(()=>[...resolved.flatMap(route=>route.points),...driverLocations.map(driver=>driver.location)],[driverLocations,resolved])
 const driverDestinations=useMemo(()=>new Map(driverLocations.map(driver=>{
  const next=resolved.find(route=>route.driver_id===driver.driver_id&&['active','paused','published','pending'].includes(route.status||''))
  return [driver.id,next?.points[next.points.length-1]||null] as const
 })),[driverLocations,resolved])
 const center=allPoints[0]||fallbackCenter
 const copy=locale==='es'
  ?{label:'Mapa operativo de rutas',loading:'Preparando mapa operativo…',unavailable:'No hay rutas activas ni conductores compartiendo ubicación.',current:'Ruta actual',pending:'Pendientes',issue:'Incidencias',driver:'Conductor',start:'Inicio'}
  :locale==='fr'
   ?{label:'Carte opérationnelle des itinéraires',loading:'Préparation de la carte opérationnelle…',unavailable:'Aucun itinéraire actif ni conducteur ne partage sa position.',current:'Itinéraire actuel',pending:'En attente',issue:'Incidents',driver:'Conducteur',start:'Départ'}
   :{label:'Route operations map',loading:'Preparing operations map…',unavailable:'No active routes or drivers are sharing location.',current:'Current route',pending:'Pending',issue:'Issues',driver:'Driver',start:'Start'}

 return <section className={styles.map} aria-label={copy.label}>
  <div className={styles.canvas}>
   {loading?<div className={styles.state}>{copy.loading}</div>:!resolved.length&&!driverLocations.length?<div className={styles.state}>{copy.unavailable}</div>:<MapContainer center={[center.lat,center.lng]} zoom={12} scrollWheelZoom={interactive} dragging={interactive} touchZoom={interactive} doubleClickZoom={interactive} zoomControl={interactive}>
    <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
    <FitBounds points={allPoints}/>
    {resolved.map(route=><Fragment key={`route-${route.id}`}>
     {route.line.length>1&&<Polyline positions={route.line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:routeColor(route.status),weight:5,opacity:.9}}/>}
     {route.points[0]&&<Marker position={[route.points[0].lat,route.points[0].lng]} icon={originMarker(routeColor(route.status))}><Tooltip direction="top" offset={[0,-14]}>{copy.start}</Tooltip></Marker>}
     {route.points[route.points.length-1]&&<Marker position={[route.points[route.points.length-1].lat,route.points[route.points.length-1].lng]} icon={routeMarker(route.number,routeColor(route.status))} zIndexOffset={200}><Tooltip direction="top" offset={[0,-16]}>{`${route.number}. ${route.destination_name||route.destination_address||copy.driver}`}</Tooltip><Popup><strong>{route.destination_name||copy.driver}</strong><br/>{statusLabel(route.status,locale)}{route.order_number?` · ${route.order_number}`:''}{route.destination_address?<><br/><small>{route.destination_address}</small></>:null}</Popup></Marker>}
    </Fragment>)}
    {driverLocations.map(driver=>{const destination=driverDestinations.get(driver.id);return <Fragment key={driver.id}>
      {destination&&<Polyline positions={[[driver.location.lat,driver.location.lng],[destination.lat,destination.lng]]} pathOptions={{color:'#2563eb',weight:3,dashArray:'7 8',opacity:.8}}/>}
      <Marker position={[driver.location.lat,driver.location.lng]} icon={driverMarker()} zIndexOffset={1000}>
       <Tooltip direction="top" offset={[0,-22]} permanent>{driver.label||copy.driver}{driver.nextStop?` · ${driver.nextStop}`:''}</Tooltip>
       <Popup><strong>{driver.label||copy.driver}</strong><br/><span>{driver.status==='on_route'?'On route':driver.status==='available'?'Available':driver.status==='unavailable'?'Location unavailable':'Driving'}</span><br/><small>{ageLabel(driver.updatedAt,locale)}</small>{driver.nextStop&&<><br/><small>{driver.nextStop}</small></>}</Popup>
      </Marker>
    </Fragment>})}
   </MapContainer>}
   <div className={styles.legend} aria-label={copy.label}><span><i className={styles.current}/>{copy.current}</span><span><i className={styles.pending}/>{copy.pending}</span><span><i className={styles.issue}/>{copy.issue}</span><span><Truck size={13}/>{driverLocations.length} {copy.driver.toLowerCase()}{driverLocations.length===1?'':'s'}</span></div>
  </div>
  <footer><span>{routes.length} {locale==='es'?'rutas configuradas':locale==='fr'?'itinéraires configurés':'configured routes'}</span><small>{driverLocations.length?`${driverLocations.length} ${copy.driver.toLowerCase()}${driverLocations.length===1?'':'s'} · ${locale==='es'?'ubicación actualizada':locale==='fr'?'position actualisée':'location updated'}`:(locale==='es'?'Sin ubicación activa':locale==='fr'?'Aucune position active':'No active location')}</small></footer>
 </section>
}
