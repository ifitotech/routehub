'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {Compass,LocateFixed,Route as RouteIcon} from 'lucide-react'
import {mapTileConfig} from '../lib/maps/map-config'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute,nextRouteManeuver} from '../lib/maps/routing'

type Coordinate={lat:number;lng:number}
type GpsFix=Coordinate&{accuracy:number;updatedAt:number;heading:number|null}
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

function FollowDriver({location,enabled}:{location:GpsFix|null;enabled:boolean}){
 const map=useMap()
 useEffect(()=>{
  if(!enabled||!location)return
  // panTo keeps the map and its tiles mounted; only the camera follows GPS.
  map.panTo([location.lat,location.lng],{animate:true,duration:.45})
  if(map.getZoom()<15)map.setZoom(16)
 },[map,location?.lat,location?.lng,enabled])
 return null
}

const driverMarker=(heading:number|null)=>L.divIcon({
 className:'route-plan-driver-location',
 html:`<span class="route-plan-driver-arrow" style="transform:rotate(${Number.isFinite(heading)?heading:0}deg)"></span>`,
 iconSize:[34,34],iconAnchor:[17,17]
})

export default function RoutePlanMap({originAddress,stops,locale='en'}:Props){
 const [points,setPoints]=useState<Coordinate[]>([])
 const [line,setLine]=useState<Coordinate[]>([])
 const [deviceLocation,setDeviceLocation]=useState<GpsFix|null>(null)
 const [gpsError,setGpsError]=useState(false)
 const [gpsClock,setGpsClock]=useState(()=>Date.now())
 const [estimate,setEstimate]=useState<{distanceMeters?:number;durationSeconds?:number;maneuvers?:Array<{instruction:string;distanceMeters?:number;coordinate:Coordinate}>}|null>(null)
 const [map,setMap]=useState<L.Map|null>(null)
 const [view,setView]=useState<'navigate'|'plan'>('navigate')
 const [navigationActive,setNavigationActive]=useState(false)
 const wakeLock=useRef<any>(null)
 const lastReroute=useRef(0)
 const navigationTarget=useRef('')
 const arrivalNotified=useRef(false)
 const [loading,setLoading]=useState(true)
 const validStops=useMemo(()=>stops.filter(stop=>Boolean(stop.address)),[stops])
 // Driver navigation shows the active stop and only one upcoming reference.
 // The driver page sorts active work first before passing these stops.
 const navigationStops=useMemo(()=>validStops.slice(0,2),[validStops])
 const displayedStops=view==='navigate'?navigationStops:validStops
 const addressKey=[originAddress,...displayedStops.map(stop=>stop.address)].filter(Boolean).join('\u001f')
 const routeCacheKey=`routehub-navigation-cache:${addressKey}:${view}`

 useEffect(()=>{
  let cancelled=false
  setLoading(true)
  const addresses=addressKey?addressKey.split('\u001f'):[]
  const restoreCached=()=>{
   try{const cached=JSON.parse(localStorage.getItem(routeCacheKey)||'');if(cached?.points?.length){setPoints(cached.points);setLine(cached.line||[]);setEstimate(cached.estimate||null);setLoading(false);return true}}catch{}
   return false
  }
  if(typeof navigator!=='undefined'&&!navigator.onLine&&restoreCached())return()=>{cancelled=true}
  Promise.all(addresses.map(address=>geocodeAddress(address))).then(async next=>{
   if(cancelled)return
   const coordinates=next.map(location=>location?.coordinate).filter(Boolean) as Coordinate[]
   setPoints(coordinates)
   setLine(view==='plan'?coordinates:[])
   setLoading(false)
   if(coordinates.length<2)return
   const routePoints=view==='plan'?coordinates:(deviceLocation?[deviceLocation,coordinates[1]]:coordinates.slice(0,2))
   const estimate=await calculateRoute(routePoints)
   if(!cancelled&&estimate.coordinates.length){setLine(estimate.coordinates);setEstimate(estimate);localStorage.setItem(routeCacheKey,JSON.stringify({points:coordinates,line:estimate.coordinates,estimate,savedAt:Date.now()}))}
  }).catch(()=>{if(!cancelled&&!restoreCached()){setPoints([]);setLine([]);setLoading(false)}})
  return()=>{cancelled=true}
 },[addressKey,view])

 useEffect(()=>{
  if(typeof navigator==='undefined'||!navigator.geolocation)return
  const watch=navigator.geolocation.watchPosition(position=>{setGpsError(false);setDeviceLocation({lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy,heading:Number.isFinite(position.coords.heading)?position.coords.heading:null,updatedAt:Date.now()})},()=>setGpsError(true),{enableHighAccuracy:true,maximumAge:5000,timeout:20000})
  return()=>navigator.geolocation.clearWatch(watch)
 },[])
 useEffect(()=>{const timer=window.setInterval(()=>setGpsClock(Date.now()),5000);return()=>window.clearInterval(timer)},[])

 useEffect(()=>{
  if(view!=='navigate'||!deviceLocation||points.length<2)return
  const target=points[1]
  const key=`${target.lat.toFixed(5)},${target.lng.toFixed(5)}`
  if(navigationTarget.current===key)return
  navigationTarget.current=key
  void calculateRoute([deviceLocation,target]).then(next=>{
   if(next.coordinates.length>1){setLine(next.coordinates);setEstimate(next)}
  })
 },[view,deviceLocation?.lat,deviceLocation?.lng,points])

 useEffect(()=>()=>{void wakeLock.current?.release?.()},[])
 const toggleNavigation=async()=>{
  if(navigationActive){await wakeLock.current?.release?.();wakeLock.current=null;setNavigationActive(false);return}
  try{wakeLock.current=await (navigator as any).wakeLock?.request?.('screen')}catch{}
  setNavigationActive(true)
 }

 useEffect(()=>{
  if(view!=='navigate'||!deviceLocation||line.length<2||!points.length)return
  const toMeters=(a:Coordinate,b:Coordinate)=>{const r=6371000,rad=Math.PI/180;const dLat=(b.lat-a.lat)*rad,dLng=(b.lng-a.lng)*rad;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
  const nearest=Math.min(...line.map(point=>toMeters(deviceLocation,point)))
  if(nearest<150||Date.now()-lastReroute.current<30000)return
  const nextStop=points[1]||points[0]
  lastReroute.current=Date.now()
  void calculateRoute([deviceLocation,nextStop]).then(next=>{if(next.coordinates.length>1){setLine(next.coordinates);setEstimate(next)}})
 },[view,deviceLocation?.lat,deviceLocation?.lng,line,points])

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
 const maneuver=useMemo(()=>nextRouteManeuver(estimate?.maneuvers,line,deviceLocation),[deviceLocation?.lat,deviceLocation?.lng,estimate?.maneuvers,line])
 const gpsWeak=Boolean(gpsError||!deviceLocation||deviceLocation.accuracy>75||gpsClock-deviceLocation.updatedAt>20_000)
 const gpsMeta=deviceLocation?`${Math.round(deviceLocation.accuracy)} m · ${Math.max(0,Math.round((gpsClock-deviceLocation.updatedAt)/1000))} s`:''
 const copy=locale==='es'?{label:'Mapa de navegación',loading:'Preparando el recorrido…',unavailable:'No pudimos ubicar las paradas todavía.',map:'Navegación',stop:'Parada',single:'parada programada',plural:'paradas programadas',complete:'Vista completa',next:'Próxima parada',gps:'GPS activo',gpsWeak:'Señal GPS débil',gpsLost:'Sin señal GPS',recenter:'Mi ubicación',exit:'Salir'}:{label:'Navigation map',loading:'Preparing route…',unavailable:'We could not locate these stops yet.',map:'Navigation',stop:'Stop',single:'scheduled stop',plural:'scheduled stops',complete:'Full route view',next:'Next stop',gps:'GPS active',gpsWeak:'Weak GPS signal',gpsLost:'GPS signal unavailable',recenter:'My location',exit:'Exit'}
 return <section className={`route-plan-map route-plan-${view}${navigationActive?' is-driving':''}`} aria-label={copy.label}>
  <header className="route-plan-nav"><div><small>{view==='navigate'?copy.next:copy.complete}</small><strong>{view==='navigate'?(navigationStops[0]?.label||navigationStops[0]?.address||copy.stop):`${validStops.length} ${validStops.length===1?copy.single:copy.plural}`}</strong></div><span className={deviceLocation&&!gpsWeak?'is-live':''}>{gpsWeak?(deviceLocation?copy.gpsWeak:copy.gpsLost):copy.gps}{deviceLocation&&<small> · {gpsMeta}</small>}</span></header>
  <div className="route-plan-tabs"><button className={view==='navigate'?'active':''} onClick={()=>setView('navigate')}>{locale==='es'?'Navegar':'Navigate'}</button><button className={view==='plan'?'active':''} onClick={()=>setView('plan')}>{locale==='es'?'Plan':'Plan'}</button></div>
  {view==='navigate'&&<div className="route-plan-actions"><button onClick={()=>void toggleNavigation()}>{navigationActive?(locale==='es'?'Detener navegación':'Stop navigation'):(locale==='es'?'Iniciar navegación':'Start navigation')}</button>{deviceLocation&&estimate?.distanceMeters!=null&&estimate.distanceMeters<75&&<button className="arrived" onClick={()=>window.dispatchEvent(new CustomEvent('routehub:arrival',{detail:{manual:true}}))}>{locale==='es'?'Llegué':'I arrived'}</button>}</div>}
  {view==='navigate'&&maneuver&&<div className="route-plan-guide"><b>{maneuver.distanceMeters!=null?`${Math.max(0,Math.round(maneuver.distanceMeters/1609.344*10)/10)} mi`:''}</b><span>{maneuver.instruction}</span></div>}
  <div className="route-plan-canvas">{loading?<div className="live-route-loading">{copy.loading}</div>:!points.length?<div className="live-route-loading">{copy.unavailable}</div>:<MapContainer ref={setMap} center={[center.lat,center.lng]} zoom={11} scrollWheelZoom={false} aria-label={copy.map}>
   <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
   <Fit points={points}/>
   <FollowDriver location={deviceLocation} enabled={view==='navigate'&&navigationActive}/>
   {line.length>1&&<Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#1763de',weight:5,opacity:.9}}/>}
   {points.slice(1).map((point,index)=><Marker key={displayedStops[index]?.id||index} position={[point.lat,point.lng]} icon={marker(index+1)}><Tooltip direction="top" offset={[0,-18]}>{displayedStops[index]?.label||`${copy.stop} ${index+1}`}</Tooltip></Marker>)}
   {deviceLocation&&<Marker position={[deviceLocation.lat,deviceLocation.lng]} icon={driverMarker(deviceLocation.heading)}><Tooltip direction="top">{locale==='es'?'Tu ubicación':'Your location'}</Tooltip></Marker>}
  </MapContainer>} {deviceLocation&&<><button className="route-plan-recenter" type="button" onClick={()=>map?.setView([deviceLocation.lat,deviceLocation.lng],15)}><LocateFixed size={18}/>{copy.recenter}</button><div className="route-plan-float-controls"><button type="button" aria-label="Compass" onClick={()=>{if(map)map.setView(map.getCenter(),map.getZoom())}}><Compass size={21}/></button><button type="button" aria-label="Route overview" onClick={()=>{if(map&&points.length>1)map.fitBounds(points.map(point=>[point.lat,point.lng] as [number,number]),{padding:[28,28],maxZoom:14})}}><RouteIcon size={21}/></button></div></>}</div>
  <footer className="route-plan-bottom"><div><strong>{deviceLocation&&estimate?.durationSeconds!=null?`${Math.max(1,Math.round(estimate.durationSeconds/60))} min`:`${validStops.length}`}</strong><span>{deviceLocation&&estimate?.distanceMeters!=null?`${Math.max(0,Math.round(estimate.distanceMeters/1609.344*10)/10)} mi · ${new Date(Date.now()+(estimate.durationSeconds||0)*1000).toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'})}`:`${validStops.length===1?copy.single:copy.plural}`}</span></div>{navigationActive?<button type="button" onClick={()=>void toggleNavigation()}>{copy.exit}</button>:<small>{estimate?.maneuvers?.[1]?.instruction|| (deviceLocation&&estimate?.distanceMeters!=null&&estimate.distanceMeters<75?(locale==='es'?'Llegaste a la próxima parada': 'Arrived at next stop'):copy.complete)}</small>}</footer>
 </section>
}
