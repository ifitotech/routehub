'use client'

import {useEffect,useMemo,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {MapPin,Route,Truck} from 'lucide-react'
import {geocodeAddress} from '../lib/maps/geocoding'
import {mapTileConfig} from '../lib/maps/map-config'
import {calculateRoute} from '../lib/maps/routing'

export type RouteCoordinate={lat:number;lng:number}
export type RouteWaypoint={address?:string|null;label?:string|null;coordinate?:RouteCoordinate|null}

type Props={
 originAddress?:string|null
 destinationAddress?:string|null
 originCoordinate?:RouteCoordinate|null
 destinationCoordinate?:RouteCoordinate|null
 waypoints?:RouteWaypoint[]
 driverLocation?:RouteCoordinate|null
 driverUpdatedAt?:string|null
 title?:string
 showHeader?:boolean
 showLocationUpdated?:boolean
  interactive?:boolean
  onActivate?:()=>void
  useDriverAsOrigin?:boolean
 locale?:string
}

const makeMarker=(kind:'origin'|'destination'|'driver'|'stop',number?:number)=>L.divIcon({
 className:'route-map-marker-wrap',
 html:kind==='driver'
  ?`<span class="route-map-marker route-map-marker-driver"><i></i></span>`
  :`<span class="route-map-marker route-map-marker-${kind}">${kind==='origin'?'S':number||1}</span>`,
 iconSize:kind==='driver'?[28,28]:[42,42],
 iconAnchor:kind==='driver'?[14,14]:[21,21]
})

function FollowDriver({location}:{location:RouteCoordinate|null}){
 const map=useMap()
 useEffect(()=>{
  if(!location)return
  map.panTo([location.lat,location.lng],{animate:true,duration:0.4})
 },[map,location?.lat,location?.lng])
 return null
}

function FitBounds({points}:{points:RouteCoordinate[]}){
 const map=useMap()
 const pointKey=points.map(point=>`${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|')
 useEffect(()=>{
  if(!points.length)return
  if(points.length===1){map.setView([points[0].lat,points[0].lng],14);return}
  map.fitBounds(points.map(point=>[point.lat,point.lng] as [number,number]),{padding:[36,36],maxZoom:16})
 },[map,pointKey])
 return null
}


function RecenterOnRequest({points, token}:{points:RouteCoordinate[]; token:number}){
 const map=useMap()
 useEffect(()=>{
  if(!token||!points.length)return
  if(points.length===1){map.setView([points[0].lat,points[0].lng],14,{animate:true});return}
  map.fitBounds(points.map(point=>[point.lat,point.lng] as [number,number]),{padding:[36,36],maxZoom:16,animate:true})
 },[map,token])
 return null
}

async function resolveCoordinate(address:string|null|undefined,known:RouteCoordinate|null|undefined){
 if(known)return known
 if(!address)return null
 try{return (await geocodeAddress(address))?.coordinate||null}catch{return null}
}

export default function LiveRouteMap({originAddress,destinationAddress,originCoordinate,destinationCoordinate,waypoints=[],driverLocation,driverUpdatedAt,title='Live route',showHeader=true,showLocationUpdated=true,interactive=true,onActivate,useDriverAsOrigin=false,locale='en',followToken=0}:Props & {followToken?:number}){
 const [routePoints,setRoutePoints]=useState<RouteCoordinate[]>([])
 const [line,setLine]=useState<RouteCoordinate[]>([])
 const [loading,setLoading]=useState(true)
 const [unavailable,setUnavailable]=useState(false)

 const waypointKey=waypoints.map(point=>`${point.address||''}:${point.coordinate?.lat||''}:${point.coordinate?.lng||''}`).join('|')
 useEffect(()=>{
  let cancelled=false
  setLoading(true)
  setUnavailable(false)
  const locations=[
    ...(useDriverAsOrigin&&driverLocation?[{address:null,coordinate:driverLocation}]:[{address:originAddress,coordinate:originCoordinate}]),
    ...waypoints,
    {address:destinationAddress,coordinate:destinationCoordinate},
  ]
  void Promise.all(locations.map(location=>resolveCoordinate(location.address,location.coordinate))).then(async coordinates=>{
   const points=coordinates.filter((point):point is RouteCoordinate=>Boolean(point))
   if(cancelled)return
   setRoutePoints(points)
   setLine(points)
   setUnavailable(!points.length)
   if(points.length>1){
    const estimate=await calculateRoute(points)
    if(!cancelled&&estimate.coordinates.length>1)setLine(estimate.coordinates)
   }
   if(!cancelled)setLoading(false)
  }).catch(()=>{if(!cancelled){setUnavailable(true);setLoading(false)}})
  return()=>{cancelled=true}
 },[originAddress,originCoordinate?.lat,originCoordinate?.lng,destinationAddress,destinationCoordinate?.lat,destinationCoordinate?.lng,waypointKey,useDriverAsOrigin,useDriverAsOrigin?driverLocation?.lat:null,useDriverAsOrigin?driverLocation?.lng:null])

 const visiblePoints=useMemo(()=>[...routePoints,...(driverLocation?[driverLocation]:[])],[routePoints,driverLocation])
 const center=visiblePoints[0]||{lat:39.8283,lng:-98.5795}
 const copy=locale==='es'
  ?{connected:'Conductor conectado',scheduled:'Ruta programada',live:'EN VIVO',waiting:'EN ESPERA',loading:'Preparando mapa…',unavailable:'No pudimos ubicar esta ruta todavía.',map:'Mapa de ruta en vivo',driver:'Conductor',start:'Inicio',next:'Próxima parada',updated:'Ubicación actualizada'}
  :locale==='fr'
   ?{connected:'Conducteur connecté',scheduled:'Itinéraire programmé',live:'EN DIRECT',waiting:'EN ATTENTE',loading:'Préparation de la carte…',unavailable:'Nous ne pouvons pas encore localiser cet itinéraire.',map:'Carte de l’itinéraire',driver:'Conducteur',start:'Départ',next:'Prochain arrêt',updated:'Position actualisée'}
   :{connected:'Driver connected',scheduled:'Route scheduled',live:'LIVE',waiting:'WAITING',loading:'Preparing map…',unavailable:'We could not locate this route yet.',map:'Live route map',driver:'Driver',start:'Start',next:'Next stop',updated:'Location updated'}
 const origin=routePoints[0]||null
 const destination=routePoints[routePoints.length-1]||null
 const intermediate=routePoints.slice(1,-1)

 return <section className={`live-route-map ${onActivate?'is-activatable':''}`} onClick={onActivate} onKeyDown={event=>{if(onActivate&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onActivate()}}} role={onActivate?'button':undefined} tabIndex={onActivate?0:undefined}>
  {showHeader&&<header className="live-route-map-head"><div><span><Route size={15}/> {title}</span><strong>{driverLocation?copy.connected:copy.scheduled}</strong></div><span className={`live-route-state ${driverLocation?'is-live':''}`}><i/>{driverLocation?copy.live:copy.waiting}</span></header>}
  <div className="live-route-canvas">
   {loading?<div className="live-route-loading">{copy.loading}</div>:unavailable?<div className="live-route-loading"><MapPin size={19}/><span>{copy.unavailable}</span></div>:<MapContainer center={[center.lat,center.lng]} zoom={15} scrollWheelZoom={interactive} dragging={interactive} touchZoom={interactive} doubleClickZoom={interactive} zoomControl={interactive} aria-label={copy.map}>
    <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
    <FitBounds points={routePoints.length?routePoints:visiblePoints}/>
    <RecenterOnRequest points={driverLocation?[driverLocation]:visiblePoints} token={followToken||0}/>
    {useDriverAsOrigin&&driverLocation&&<FollowDriver location={driverLocation}/>}
    {line.length>1&&<Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#1A73E8',weight:6,opacity:0.92,lineJoin:'round',lineCap:'round'}}/>}
    {origin&&(!useDriverAsOrigin||!driverLocation)&&<Marker position={[origin.lat,origin.lng]} icon={makeMarker('origin')} zIndexOffset={200}><Tooltip direction="top" offset={[0,-18]}>{copy.start}</Tooltip></Marker>}
    {intermediate.map((point,index)=><Marker key={`stop-${index}`} position={[point.lat,point.lng]} icon={makeMarker('stop',index+2)}><Tooltip direction="top" offset={[0,-18]}>{waypoints[index]?.label||`${copy.next} ${index+2}`}</Tooltip></Marker>)}
    {destination&&<Marker position={[destination.lat,destination.lng]} icon={makeMarker('destination',1)} zIndexOffset={300}><Tooltip direction="top" offset={[0,-18]}>{destinationAddress||copy.next}</Tooltip></Marker>}
    {driverLocation&&<Marker position={[driverLocation.lat,driverLocation.lng]} icon={makeMarker('driver')} zIndexOffset={1000}><Tooltip direction="top" offset={[0,-20]} permanent>{copy.driver}</Tooltip></Marker>}
   </MapContainer>}
  </div>
  <footer><span><b>S</b>{useDriverAsOrigin&&driverLocation?(locale==='es'?'Mi ubicación':locale==='fr'?'Ma position': 'My location'):(originAddress||copy.start)}</span><span><b>1</b>{destinationAddress||copy.next}</span>{showLocationUpdated&&driverUpdatedAt&&<small><Truck size={13}/>{copy.updated}</small>}</footer>
 </section>
}
