'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import {geocodeAddress} from '../lib/maps/geocoding'
import {loadGoogleMaps} from '../lib/maps/google-maps'
import {calculateRoute} from '../lib/maps/routing'
import {sanitizeCoordinate} from '../lib/maps/coordinates'
import styles from './operations-map.module.css'

type Coordinate={lat:number;lng:number}
type MapObject={setMap:(map:null)=>void}
type GoogleMap={fitBounds:(bounds:unknown,padding?:number)=>void;setCenter:(center:Coordinate)=>void;setZoom:(zoom:number)=>void}
type MapsApi={
 Map:new(element:HTMLElement,options:Record<string,unknown>)=>GoogleMap
 Marker:new(options:Record<string,unknown>)=>MapObject
 Polyline:new(options:Record<string,unknown>)=>MapObject
 LatLngBounds:new()=>{extend:(point:Coordinate)=>void}
 SymbolPath:{CIRCLE:unknown;FORWARD_CLOSED_ARROW:unknown}
}

function driverTruckIcon(){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46"><circle cx="23" cy="23" r="21" fill="#0b1f3a" stroke="white" stroke-width="3"/><path fill="white" d="M11 14h17v14h4.2l3.8 4v4h-3a3.5 3.5 0 0 1-7 0h-7a3.5 3.5 0 0 1-7 0H8v-18c0-2.2 1.2-4 3-4Zm4 20a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm14.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm1-4h3l-2-2h-1v2Z"/></svg>'
 return {url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`}
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

type Stop=OperationsRoute&{destination:Coordinate|null;number:number}
type Props={routes:OperationsRoute[];driverLocations?:OperationsDriverLocation[];locale?:string;interactive?:boolean;hideFooter?:boolean;compact?:boolean;onSummary?:(summary:{count:number;distanceMeters?:number;durationSeconds?:number}|null)=>void}

const miami:Coordinate={lat:25.857,lng:-80.278}
const isPoint=(lat:number|null|undefined,lng:number|null|undefined):Coordinate|null=>{
 return sanitizeCoordinate({lat,lng})
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

async function locate(address:string|null|undefined,lat:number|null|undefined,lng:number|null|undefined){
 const known=isPoint(lat,lng)
 if(known)return known
 if(!address)return null
 try{return sanitizeCoordinate((await geocodeAddress(address))?.coordinate||null)}catch{return null}
}

export default function OperationsMap({routes,driverLocations=[],locale='en',interactive=true,hideFooter=false,compact=false,onSummary}:Props){
 const containerRef=useRef<HTMLDivElement>(null)
 const mapRef=useRef<GoogleMap|null>(null)
 const mapObjectsRef=useRef<MapObject[]>([])
 const summaryRef=useRef(onSummary)
 const [stops,setStops]=useState<Stop[]>([])
 const [line,setLine]=useState<Coordinate[]>([])
 const [mapError,setMapError]=useState('')
 summaryRef.current=onSummary

 const ordered=useMemo(()=>routes.slice().sort((a,b)=>Number(a.position||0)-Number(b.position||0)||a.id.localeCompare(b.id)),[routes])
 const routeKey=ordered.map(route=>[route.id,route.status,route.position,route.destination_lat,route.destination_lng,route.destination_address,route.origin_lat,route.origin_lng,route.driver_id].join(':')).join('|')
 const driver=driverLocations.map(item=>({...item,location:sanitizeCoordinate(item.location)})).find(item=>Boolean(item.location)) as (OperationsDriverLocation&{location:Coordinate})|undefined
 // Moving GPS fixes update only the marker; paid route calculations run when the route plan or driver changes.
 const routePlanKey=`${routeKey}|${driver?.driver_id||''}`

 useEffect(()=>{
  let cancelled=false
  const instant:Stop[]=ordered.map((route,index)=>({...route,destination:isPoint(route.destination_lat,route.destination_lng),number:index+1}))
  const open=instant.filter(route=>openStatus(route.status)&&route.destination)
  const start=driver?.location||isPoint(ordered[0]?.origin_lat,ordered[0]?.origin_lng)
  setStops(instant)
  setLine([start,...(open.length?open:instant.filter(route=>route.destination)).map(route=>route.destination)].filter((point):point is Coordinate=>Boolean(point)))
  summaryRef.current?.({count:open.length})

  void (async()=>{
   const resolved:Stop[]=[]
   for(const [index,route] of ordered.entries())resolved.push({...route,destination:await locate(route.destination_address,route.destination_lat,route.destination_lng),number:index+1})
   if(cancelled)return
   const pending=resolved.filter(route=>openStatus(route.status)&&route.destination)
   const visible=pending.length?pending:resolved.filter(route=>route.destination)
   const numbered=resolved.map((route,index)=>{
    const pendingIndex=pending.findIndex(item=>item.id===route.id)
    return {...route,number:pendingIndex>=0?pendingIndex+1:index+1}
   })
   const origin=driver?.location||await locate(ordered[0]?.origin_address,ordered[0]?.origin_lat,ordered[0]?.origin_lng)
   const waypoints=[origin,...visible.map(route=>route.destination)].filter((point):point is Coordinate=>Boolean(point)).filter((point,index,list)=>index===0||point.lat!==list[index-1].lat||point.lng!==list[index-1].lng)
   setStops(numbered)
   setLine(waypoints)
   if(waypoints.length<2){summaryRef.current?.({count:pending.length});return}
   const estimate=await calculateRoute(waypoints)
   if(cancelled)return
   setLine(estimate.coordinates.length>1?estimate.coordinates:waypoints)
   summaryRef.current?.({count:pending.length,distanceMeters:estimate.distanceMeters,durationSeconds:estimate.durationSeconds})
  })()
  return()=>{cancelled=true}
 // routePlanKey intentionally excludes moving coordinates to protect the daily Routes API quota.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[routePlanKey])

 const renderKey=[line.map(point=>`${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|'),stops.map(stop=>`${stop.id}:${stop.number}:${stop.status}:${stop.destination?.lat}:${stop.destination?.lng}`).join('|'),driver?`${driver.location.lat}:${driver.location.lng}:${driver.nextStop||''}`:''].join('::')
 useEffect(()=>{
  let cancelled=false
  void loadGoogleMaps().then(raw=>{
   if(cancelled||!containerRef.current)return
   const maps=raw as unknown as MapsApi
   const map=mapRef.current||(mapRef.current=new maps.Map(containerRef.current,{center:miami,zoom:12,disableDefaultUI:false,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,gestureHandling:interactive?'auto':'none',styles:[{featureType:'poi',stylers:[{visibility:'off'}]}]}))
   mapObjectsRef.current.forEach(item=>item.setMap(null))
   mapObjectsRef.current=[]
   if(line.length>1){
    mapObjectsRef.current.push(new maps.Polyline({map,path:line,strokeColor:'#ffffff',strokeOpacity:1,strokeWeight:9,zIndex:1}))
    mapObjectsRef.current.push(new maps.Polyline({map,path:line,strokeColor:'#1667F2',strokeOpacity:1,strokeWeight:5,zIndex:2}))
   }
   for(const stop of stops){
    if(!stop.destination)continue
    const color=colorFor(stop.status)
    mapObjectsRef.current.push(new maps.Marker({map,position:stop.destination,title:`${stop.number}. ${typeLabel(stop.mission_type,locale)} · ${stop.destination_name||stop.destination_address||''}`,label:{text:stop.status==='completed'?'✓':String(stop.number),color:'#ffffff',fontWeight:'800'},icon:{path:maps.SymbolPath.CIRCLE,scale:16,fillColor:color,fillOpacity:1,strokeColor:'#ffffff',strokeWeight:3}}))
   }
   if(driver)mapObjectsRef.current.push(new maps.Marker({map,position:driver.location,title:`${driver.label||'Driver'}${driver.nextStop?` · ${driver.nextStop}`:''}`,icon:driverTruckIcon(),zIndex:1000}))
   const points=[...line,...stops.map(stop=>stop.destination),driver?.location].filter((point):point is Coordinate=>Boolean(point))
   if(points.length>1){const bounds=new maps.LatLngBounds();points.forEach(point=>bounds.extend(point));map.fitBounds(bounds,42)}
   else if(points.length===1){map.setCenter(points[0]);map.setZoom(14)}
   else{map.setCenter(miami);map.setZoom(12)}
   setMapError('')
  }).catch(error=>{if(!cancelled)setMapError(error instanceof Error?error.message:'Google Maps is unavailable.')})
  return()=>{cancelled=true}
 },[renderKey,interactive,locale,line,stops,driver])

 const copy=locale==='es'?{label:'Mapa operativo',empty:'No hay paradas con dirección hoy.',driver:'Conductor'}:locale==='fr'?{label:'Carte opérationnelle',empty:'Aucun arrêt avec adresse aujourd’hui.',driver:'Conducteur'}:{label:'Operations map',empty:'No stops with an address today.',driver:'Driver'}
 return <section className={`${styles.map}${compact?` ${styles.compact}`:''}`} aria-label={copy.label}>
  <div className={styles.canvas}><div ref={containerRef} className={styles.googleMap}/>{mapError&&<div className={styles.state}>{mapError}</div>}{!mapError&&!stops.length&&!driver&&<div className={styles.state}>{copy.empty}</div>}</div>
  {!hideFooter&&<footer><span>{stops.length} {locale==='es'?'rutas':locale==='fr'?'itinéraires':'routes'}</span><small>{line.length>1?(locale==='es'?'Recorrido listo':locale==='fr'?'Trajet prêt':'Route ready'):(locale==='es'?'Sin recorrido':locale==='fr'?'Pas de trajet':'No path yet')}</small></footer>}
 </section>
}
