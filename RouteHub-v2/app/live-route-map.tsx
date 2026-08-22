'use client'

import {useEffect,useMemo,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {MapPin,Route,Truck} from 'lucide-react'

export type RouteCoordinate={lat:number;lng:number}

type Props={
 originAddress?:string|null
 destinationAddress?:string|null
 driverLocation?:RouteCoordinate|null
  driverUpdatedAt?:string|null
  title?:string
  showHeader?:boolean
  showLocationUpdated?:boolean
  interactive?:boolean
  locale?:string
}

type GeocodeResponse={coordinate:RouteCoordinate|null;label?:string}

const makeMarker=(kind:'origin'|'destination'|'driver')=>L.divIcon({
 className:'route-map-marker-wrap',
 html:`<span class="route-map-marker route-map-marker-${kind}">${kind==='driver'?'🚚':kind==='origin'?'A':'B'}</span>`,
 iconSize:[38,38],
 iconAnchor:[19,19]
})

function FitBounds({points}:{points:RouteCoordinate[]}){
 const map=useMap()
 const key=points.map(point=>`${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|')
 useEffect(()=>{
  if(!points.length)return
  if(points.length===1){map.setView([points[0].lat,points[0].lng],13);return}
  map.fitBounds(points.map(point=>[point.lat,point.lng] as [number,number]),{padding:[16,16],maxZoom:15})
 },[map,key,points])
 return null
}

async function geocode(address?:string|null){
 if(!address)return null
 const result=await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
 if(!result.ok)return null
 const payload=await result.json() as GeocodeResponse
 return payload.coordinate||null
}

export default function LiveRouteMap({originAddress,destinationAddress,driverLocation,driverUpdatedAt,title='Live route',showHeader=true,showLocationUpdated=true,interactive=true,locale='en'}:Props){
 const[origin,setOrigin]=useState<RouteCoordinate|null>(null)
 const[destination,setDestination]=useState<RouteCoordinate|null>(null)
  const[line,setLine]=useState<RouteCoordinate[]>([])
 const[loading,setLoading]=useState(true)
 const[unavailable,setUnavailable]=useState(false)

 useEffect(()=>{
  let cancelled=false
  setLoading(true)
  setUnavailable(false)
  Promise.all([geocode(originAddress),geocode(destinationAddress)]).then(([nextOrigin,nextDestination])=>{
   if(cancelled)return
   setOrigin(nextOrigin)
   setDestination(nextDestination)
   setLine(nextOrigin&&nextDestination?[nextOrigin,nextDestination]:[])
   setUnavailable(!nextOrigin&&!nextDestination)
   setLoading(false)
  }).catch(()=>{if(!cancelled){setUnavailable(true);setLoading(false)}})
  return()=>{cancelled=true}
 },[originAddress,destinationAddress])

 useEffect(()=>{
  let cancelled=false
  if(!origin||!destination)return
  const url=`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
  fetch(url).then(async result=>{
   if(!result.ok)throw new Error('Route unavailable')
   const payload=await result.json() as {routes?:Array<{geometry?:{coordinates?:[number,number][]}}>} 
   const coordinates=payload.routes?.[0]?.geometry?.coordinates?.map(([lng,lat])=>({lat,lng}))||[]
   if(!cancelled&&coordinates.length)setLine(coordinates)
  }).catch(()=>{})
  return()=>{cancelled=true}
  },[origin,destination])

 const visiblePoints=useMemo(()=>[origin,destination,driverLocation].filter(Boolean) as RouteCoordinate[],[origin,destination,driverLocation])
 const center=visiblePoints[0]||{lat:39.8283,lng:-98.5795}
 const copy=locale==='es'?{connected:'Conductor conectado',scheduled:'Ruta programada',live:'EN VIVO',waiting:'EN ESPERA',loading:'Preparando el mapa…',unavailable:'No pudimos ubicar esta ruta todavía.',map:'Mapa de ruta en vivo',driver:'Conductor',origin:'Origen de ruta',destination:'Destino de ruta',updated:'Ubicación actualizada'}:locale==='fr'?{connected:'Conducteur connecté',scheduled:'Itinéraire programmé',live:'EN DIRECT',waiting:'EN ATTENTE',loading:'Préparation de la carte…',unavailable:'Nous ne pouvons pas encore localiser cet itinéraire.',map:'Carte de l’itinéraire',driver:'Conducteur',origin:'Origine de l’itinéraire',destination:'Destination de l’itinéraire',updated:'Position actualisée'}:{connected:'Driver connected',scheduled:'Route scheduled',live:'LIVE',waiting:'WAITING',loading:'Preparing map…',unavailable:'We could not locate this route yet.',map:'Live route map',driver:'Driver',origin:'Route origin',destination:'Route destination',updated:'Location updated'}

 return <section className="live-route-map">
  {showHeader&&<header className="live-route-map-head"><div><span><Route size={15}/> {title}</span><strong>{driverLocation?copy.connected:copy.scheduled}</strong></div><span className={`live-route-state ${driverLocation?'is-live':''}`}><i/>{driverLocation?copy.live:copy.waiting}</span></header>}
  <div className="live-route-canvas">
   {loading?<div className="live-route-loading">{copy.loading}</div>:unavailable?<div className="live-route-loading"><MapPin size={19}/><span>{copy.unavailable}</span></div>:<MapContainer center={[center.lat,center.lng]} zoom={12} scrollWheelZoom={false} dragging={interactive} touchZoom={interactive} doubleClickZoom={interactive} zoomControl={interactive} aria-label={copy.map}>
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
    <FitBounds points={visiblePoints}/>
    {line.length>1&&<Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#1763de',weight:5,opacity:.88}}/>}
    {origin&&<Marker position={[origin.lat,origin.lng]} icon={makeMarker('origin')}><Tooltip direction="top" offset={[0,-18]}>Punto A</Tooltip></Marker>}
    {destination&&<Marker position={[destination.lat,destination.lng]} icon={makeMarker('destination')}><Tooltip direction="top" offset={[0,-18]}>Punto B</Tooltip></Marker>}
    {driverLocation&&<Marker position={[driverLocation.lat,driverLocation.lng]} icon={makeMarker('driver')}><Tooltip direction="top" offset={[0,-20]} permanent>{copy.driver}</Tooltip></Marker>}
   </MapContainer>}
  </div>
  <footer><span><b>A</b>{originAddress||copy.origin}</span><span><b>B</b>{destinationAddress||copy.destination}</span>{showLocationUpdated&&driverUpdatedAt&&<small><Truck size={13}/>{copy.updated}</small>}</footer>
 </section>
}
