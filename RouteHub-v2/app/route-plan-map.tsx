'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {mapTileConfig} from '../lib/maps/map-config'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute} from '../lib/maps/routing'

type Coordinate={lat:number;lng:number}
export type PlannedStop={id:string;address?:string|null;label?:string|null}

type Props={originAddress?:string|null;stops:PlannedStop[];locale?:string}

const marker=(number:number)=>L.divIcon({
 className:'route-plan-marker-wrap',
 html:`<span class="route-plan-marker">${number}</span>`,
 iconSize:[36,36],iconAnchor:[18,18]
})

function Fit({points}:{points:Coordinate[]}){
 const map=useMap()
 const key=points.map(point=>`${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join('|')
 useEffect(()=>{if(points.length>1)map.fitBounds(points.map(point=>[point.lat,point.lng] as [number,number]),{padding:[28,28],maxZoom:14});else if(points[0])map.setView([points[0].lat,points[0].lng],13)},[map,key,points])
 return null
}

export default function RoutePlanMap({originAddress,stops,locale='en'}:Props){
 const [points,setPoints]=useState<Coordinate[]>([])
 const [line,setLine]=useState<Coordinate[]>([])
 const [deviceLocation,setDeviceLocation]=useState<Coordinate|null>(null)
 const [estimate,setEstimate]=useState<{distanceMeters?:number;durationSeconds?:number}|null>(null)
 const lastReroute=useRef(0)
 const arrivalNotified=useRef(false)
 const [loading,setLoading]=useState(true)
 const validStops=useMemo(()=>stops.filter(stop=>Boolean(stop.address)),[stops])
 const addresses=useMemo(()=>[originAddress,...validStops.map(stop=>stop.address)].filter(Boolean) as string[],[originAddress,validStops])

 useEffect(()=>{
  let cancelled=false
  setLoading(true)
  Promise.all(addresses.map(address=>geocodeAddress(address))).then(async next=>{
   if(cancelled)return
   const coordinates=next.map(location=>location?.coordinate).filter(Boolean) as Coordinate[]
   setPoints(coordinates)
   setLine(coordinates)
   setLoading(false)
   if(coordinates.length<2)return
   const estimate=await calculateRoute(coordinates)
   if(!cancelled&&estimate.coordinates.length){setLine(estimate.coordinates);setEstimate(estimate)}
  }).catch(()=>{if(!cancelled){setPoints([]);setLine([]);setLoading(false)}})
  return()=>{cancelled=true}
 },[addresses])

 useEffect(()=>{
  if(typeof navigator==='undefined'||!navigator.geolocation)return
  const watch=navigator.geolocation.watchPosition(position=>setDeviceLocation({lat:position.coords.latitude,lng:position.coords.longitude}),()=>undefined,{enableHighAccuracy:true,maximumAge:5000,timeout:20000})
  return()=>navigator.geolocation.clearWatch(watch)
 },[])

 useEffect(()=>{
  if(!deviceLocation||line.length<2||!points.length)return
  const toMeters=(a:Coordinate,b:Coordinate)=>{const r=6371000,rad=Math.PI/180;const dLat=(b.lat-a.lat)*rad,dLng=(b.lng-a.lng)*rad;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
  const nearest=Math.min(...line.map(point=>toMeters(deviceLocation,point)))
  if(nearest<150||Date.now()-lastReroute.current<30000)return
  const nextStop=points[1]||points[0]
  lastReroute.current=Date.now()
  void calculateRoute([deviceLocation,nextStop]).then(next=>{if(next.coordinates.length>1){setLine(next.coordinates);setEstimate(next)}})
 },[deviceLocation?.lat,deviceLocation?.lng,line,points])

 useEffect(()=>{
  if(!deviceLocation||!points.length)return
  const target=points[1]||points[0]
  const radians=Math.PI/180
  const dLat=(target.lat-deviceLocation.lat)*radians,dLng=(target.lng-deviceLocation.lng)*radians
  const a=Math.sin(dLat/2)**2+Math.cos(deviceLocation.lat*radians)*Math.cos(target.lat*radians)*Math.sin(dLng/2)**2
  const distance=2*6371000*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
  if(distance<75&&!arrivalNotified.current){arrivalNotified.current=true;window.dispatchEvent(new CustomEvent('routehub:arrival',{detail:{distance}}))}
  if(distance>=100)arrivalNotified.current=false
 },[deviceLocation?.lat,deviceLocation?.lng,points])

 const center=points[0]||{lat:39.8283,lng:-98.5795}
 const copy=locale==='es'?{label:'Mapa de todas las paradas',loading:'Preparando el recorrido…',unavailable:'No pudimos ubicar las paradas todavía.',map:'Recorrido completo',stop:'Parada',single:'parada programada',plural:'paradas programadas',complete:'Vista completa de la ruta'}:locale==='fr'?{label:'Carte de tous les arrêts',loading:'Préparation de l’itinéraire…',unavailable:'Nous ne pouvons pas encore localiser les arrêts.',map:'Itinéraire complet',stop:'Arrêt',single:'arrêt programmé',plural:'arrêts programmés',complete:'Vue complète de l’itinéraire'}:{label:'Map of all stops',loading:'Preparing route…',unavailable:'We could not locate these stops yet.',map:'Full route',stop:'Stop',single:'scheduled stop',plural:'scheduled stops',complete:'Full route view'}
 return <section className="route-plan-map" aria-label={copy.label}>
  <div className="route-plan-canvas">{loading?<div className="live-route-loading">{copy.loading}</div>:!points.length?<div className="live-route-loading">{copy.unavailable}</div>:<MapContainer center={[center.lat,center.lng]} zoom={11} scrollWheelZoom={false} aria-label={copy.map}>
   <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
   <Fit points={points}/>
   {line.length>1&&<Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#1763de',weight:5,opacity:.9}}/>}
   {points.slice(1).map((point,index)=><Marker key={validStops[index]?.id||index} position={[point.lat,point.lng]} icon={marker(index+1)}><Tooltip direction="top" offset={[0,-18]}>{validStops[index]?.label||`${copy.stop} ${index+1}`}</Tooltip></Marker>)}
   {deviceLocation&&<Marker position={[deviceLocation.lat,deviceLocation.lng]} icon={L.divIcon({className:'route-plan-driver-location',html:'<span style="display:block;width:18px;height:18px;border-radius:50%;background:#1763de;border:3px solid #fff;box-shadow:0 1px 8px #1238;"/>',iconSize:[18,18],iconAnchor:[9,9]})}><Tooltip direction="top">{locale==='es'?'Tu ubicación':'Your location'}</Tooltip></Marker>}
  </MapContainer>}</div>
  <footer><span>{deviceLocation&&estimate?.distanceMeters!=null?`${Math.max(0,Math.round(estimate.distanceMeters/1609.344*10)/10)} mi · ${Math.max(1,Math.round((estimate.durationSeconds||0)/60))} min`: `${validStops.length} ${validStops.length===1?copy.single:copy.plural}`}</span><small>{deviceLocation&&estimate?.distanceMeters!=null&&estimate.distanceMeters<75?(locale==='es'?'Llegaste a la próxima parada': 'Arrived at next stop'):copy.complete}</small></footer>
 </section>
}
