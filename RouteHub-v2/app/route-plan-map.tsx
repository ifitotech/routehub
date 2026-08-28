'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {ArrowUp,Compass,CornerUpLeft,CornerUpRight,Flag,LocateFixed,Navigation2,RotateCcw,Route as RouteIcon,Satellite,WifiOff} from 'lucide-react'
import {mapTileConfig} from '../lib/maps/map-config'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute,distanceMeters,nextRouteManeuver,remainingRouteDistance} from '../lib/maps/routing'
import type {ActiveRouteManeuver} from '../lib/maps/types'

type Coordinate={lat:number;lng:number}
type GpsFix=Coordinate&{accuracy:number;updatedAt:number;heading:number|null}
export type PlannedStop={id:string;address?:string|null;label?:string|null}

type Props={originAddress?:string|null;stops:PlannedStop[];locale?:string;navigationOnly?:boolean}

const marker=(number:number,active=false)=>L.divIcon({
 className:'route-plan-marker-wrap',
 html:`<span class="route-plan-marker${active?' is-active':''}">${number}</span>`,
 iconSize:[36,36],iconAnchor:[18,18]
})

function formatDistance(meters:number|undefined){
 if(!Number.isFinite(meters))return ''
 if(meters!<160)return `${Math.max(50,Math.round(meters!*3.28084/50)*50)} ft`
 return `${Math.max(.1,Math.round(meters!/1609.344*10)/10)} mi`
}

function maneuverInstruction(maneuver:ActiveRouteManeuver|undefined,locale:string){
 if(!maneuver)return locale==='es'?'Continúa por la ruta':'Continue on route'
 const street=maneuver.streetName?.trim()
 const modifier=maneuver.modifier||''
 const type=maneuver.type||''
 if(locale!=='es')return maneuver.instruction
 if(type==='arrive')return street?`Llegarás a ${street}`:'Llegarás al destino'
 if(type.includes('roundabout')||type==='rotary')return street?`En la rotonda, toma la salida hacia ${street}`:'Entra en la rotonda'
 if(modifier.includes('u-turn'))return street?`Haz un retorno hacia ${street}`:'Haz un retorno'
 if(modifier.includes('left'))return street?`Gira a la izquierda en ${street}`:'Gira a la izquierda'
 if(modifier.includes('right'))return street?`Gira a la derecha en ${street}`:'Gira a la derecha'
 if(type==='depart')return street?`Continúa por ${street}`:'Inicia el recorrido'
 return street?`Continúa por ${street}`:'Continúa recto'
}

function ManeuverIcon({maneuver}:{maneuver:ActiveRouteManeuver|undefined}){
 const modifier=maneuver?.modifier||''
 const type=maneuver?.type||''
 if(type==='arrive')return <Flag aria-hidden="true"/>
 if(type.includes('roundabout')||type==='rotary'||modifier.includes('u-turn'))return <RotateCcw aria-hidden="true"/>
 if(modifier.includes('left'))return <CornerUpLeft aria-hidden="true"/>
 if(modifier.includes('right'))return <CornerUpRight aria-hidden="true"/>
 return <ArrowUp aria-hidden="true"/>
}

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

export default function RoutePlanMap({originAddress,stops,locale='en',navigationOnly=false}:Props){
 const driverMode=navigationOnly||(typeof window!=='undefined'&&window.location.pathname==='/driver')
 const [points,setPoints]=useState<Coordinate[]>([])
 const [line,setLine]=useState<Coordinate[]>([])
 const [deviceLocation,setDeviceLocation]=useState<GpsFix|null>(null)
 const [gpsError,setGpsError]=useState(false)
 const [gpsClock,setGpsClock]=useState(()=>Date.now())
 const [estimate,setEstimate]=useState<{distanceMeters?:number;durationSeconds?:number;maneuvers?:Array<{instruction:string;distanceMeters?:number;coordinate:Coordinate}>}|null>(null)
 const [map,setMap]=useState<L.Map|null>(null)
 const [view,setView]=useState<'navigate'|'plan'>('navigate')
 const [navigationActive,setNavigationActive]=useState(false)
 const [offRoute,setOffRoute]=useState(false)
 const [rerouting,setRerouting]=useState(false)
 const [online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine)
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
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])

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
 useEffect(()=>{
  const restore=async()=>{
   if(!navigationActive||document.visibilityState!=='visible'||(wakeLock.current&&!wakeLock.current.released))return
   try{wakeLock.current=await (navigator as any).wakeLock?.request?.('screen')}catch{}
  }
  document.addEventListener('visibilitychange',restore)
  return()=>document.removeEventListener('visibilitychange',restore)
 },[navigationActive])
 const toggleNavigation=async()=>{
  if(navigationActive){await wakeLock.current?.release?.();wakeLock.current=null;setNavigationActive(false);return}
  try{wakeLock.current=await (navigator as any).wakeLock?.request?.('screen')}catch{}
  setNavigationActive(true)
  window.setTimeout(()=>{map?.invalidateSize();if(deviceLocation)map?.setView([deviceLocation.lat,deviceLocation.lng],17,{animate:false})},60)
 }

 useEffect(()=>{
  if(view!=='navigate'||!deviceLocation||line.length<2||!points.length)return
  const nearest=remainingRouteDistance(line,deviceLocation).distanceFromRouteMeters
  setOffRoute(nearest>=150)
  if(nearest<150||Date.now()-lastReroute.current<30000||!online)return
  const nextStop=points[1]||points[0]
  lastReroute.current=Date.now()
  setRerouting(true)
  void calculateRoute([deviceLocation,nextStop]).then(next=>{if(next.coordinates.length>1){setLine(next.coordinates);setEstimate(next);setOffRoute(false)}}).finally(()=>setRerouting(false))
 },[view,deviceLocation?.lat,deviceLocation?.lng,line,points,online])

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
 const routeProgress=useMemo(()=>remainingRouteDistance(line,deviceLocation),[line,deviceLocation?.lat,deviceLocation?.lng])
 const destination=points[1]||points[0]
 const destinationDistance=deviceLocation&&destination?distanceMeters(deviceLocation,destination):undefined
 const nearDestination=Number.isFinite(destinationDistance)&&destinationDistance!<75
 const remainingDistance=deviceLocation&&line.length>1?routeProgress.distanceMeters:estimate?.distanceMeters
 const remainingDuration=remainingDistance!=null&&estimate?.distanceMeters&&estimate.durationSeconds?Math.max(30,estimate.durationSeconds*(remainingDistance/estimate.distanceMeters)):estimate?.durationSeconds
 const gpsWeak=Boolean(gpsError||!deviceLocation||deviceLocation.accuracy>75||gpsClock-deviceLocation.updatedAt>20_000)
 const gpsMeta=deviceLocation?`${Math.round(deviceLocation.accuracy)} m · ${Math.max(0,Math.round((gpsClock-deviceLocation.updatedAt)/1000))} s`:''
 const copy=locale==='es'?{label:'Mapa de navegación',loading:'Preparando el recorrido…',unavailable:'No pudimos ubicar las paradas todavía.',map:'Navegación',stop:'Parada',single:'parada programada',plural:'paradas programadas',complete:'Vista completa',next:'Próxima parada',gps:'GPS activo',gpsWeak:'Señal GPS débil',gpsLost:'Sin señal GPS',recenter:'Recentrar',exit:'Salir',arrived:'Llegué',rerouting:'Recalculando ruta…',offRoute:'Fuera de ruta',offline:'Sin conexión · usando la última ruta'}:{label:'Navigation map',loading:'Preparing route…',unavailable:'We could not locate these stops yet.',map:'Navigation',stop:'Stop',single:'scheduled stop',plural:'scheduled stops',complete:'Full route view',next:'Next stop',gps:'GPS active',gpsWeak:'Weak GPS signal',gpsLost:'GPS signal unavailable',recenter:'Re-center',exit:'Exit',arrived:'Arrived',rerouting:'Rerouting…',offRoute:'Off route',offline:'Offline · using last route'}
 return <section className={`route-plan-map route-plan-${view}${driverMode?' route-plan-driver':''}${navigationActive?' is-driving':''}`} aria-label={copy.label}>
  <header className="route-plan-nav"><div><small>{view==='navigate'?copy.next:copy.complete}</small><strong>{view==='navigate'?(navigationStops[0]?.label||navigationStops[0]?.address||copy.stop):`${validStops.length} ${validStops.length===1?copy.single:copy.plural}`}</strong></div><span className={deviceLocation&&!gpsWeak?'is-live':''}>{gpsWeak?(deviceLocation?copy.gpsWeak:copy.gpsLost):copy.gps}{deviceLocation&&<small> · {gpsMeta}</small>}</span></header>
  {!driverMode&&<div className="route-plan-tabs"><button className={view==='navigate'?'active':''} onClick={()=>setView('navigate')}>{locale==='es'?'Navegar':'Navigate'}</button><button className={view==='plan'?'active':''} onClick={()=>setView('plan')}>{locale==='es'?'Plan':'Plan'}</button></div>}
  {view==='navigate'&&!navigationActive&&<div className="route-plan-actions"><button onClick={()=>void toggleNavigation()}><Navigation2 size={19}/>{locale==='es'?'Iniciar navegación':'Start navigation'}</button></div>}
  {view==='navigate'&&navigationActive&&<div className="route-plan-guide" aria-live="polite"><ManeuverIcon maneuver={maneuver}/><div><b>{formatDistance(maneuver?.distanceToManeuverMeters)}</b><span>{maneuverInstruction(maneuver,locale)}</span></div></div>}
  {view==='navigate'&&navigationActive&&(rerouting||offRoute||!online||gpsWeak)&&<div className={`route-plan-driving-alert${rerouting||offRoute?' is-warning':''}`}>{!online?<WifiOff size={16}/>:gpsWeak?<Satellite size={16}/>:<RouteIcon size={16}/>}<span>{!online?copy.offline:rerouting?copy.rerouting:offRoute?copy.offRoute:(deviceLocation?copy.gpsWeak:copy.gpsLost)}</span></div>}
  <div className="route-plan-canvas">{loading?<div className="live-route-loading">{copy.loading}</div>:!points.length?<div className="live-route-loading">{copy.unavailable}</div>:<MapContainer ref={setMap} center={[center.lat,center.lng]} zoom={11} scrollWheelZoom={false} aria-label={copy.map}>
   <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
   <Fit points={points}/>
   <FollowDriver location={deviceLocation} enabled={view==='navigate'&&navigationActive}/>
   {line.length>1&&<Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#1763de',weight:5,opacity:.9}}/>}
   {points.slice(1).map((point,index)=><Marker key={displayedStops[index]?.id||index} position={[point.lat,point.lng]} icon={marker(index+1,index===0)}><Tooltip direction="top" offset={[0,-18]}>{displayedStops[index]?.label||`${copy.stop} ${index+1}`}</Tooltip></Marker>)}
   {deviceLocation&&<Marker position={[deviceLocation.lat,deviceLocation.lng]} icon={driverMarker(deviceLocation.heading)}><Tooltip direction="top">{locale==='es'?'Tu ubicación':'Your location'}</Tooltip></Marker>}
  </MapContainer>} {deviceLocation&&<><button className="route-plan-recenter" type="button" onClick={()=>map?.setView([deviceLocation.lat,deviceLocation.lng],navigationActive?17:15)}><LocateFixed size={20}/><span>{copy.recenter}</span></button><div className="route-plan-float-controls"><button type="button" aria-label="Compass" onClick={()=>{if(map)map.setView(map.getCenter(),map.getZoom())}}><Compass size={21}/></button><button type="button" aria-label="Route overview" onClick={()=>{if(map&&points.length>1)map.fitBounds(points.map(point=>[point.lat,point.lng] as [number,number]),{padding:[28,28],maxZoom:14})}}><RouteIcon size={21}/></button></div></>}</div>
  <footer className="route-plan-bottom"><i aria-hidden="true"/><div className="route-plan-summary"><strong>{remainingDuration!=null?`${Math.max(1,Math.round(remainingDuration/60))} min`:`${validStops.length}`}</strong><span>{remainingDistance!=null?`${formatDistance(remainingDistance)} · ${new Date(Date.now()+(remainingDuration||0)*1000).toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'})}`:`${validStops.length===1?copy.single:copy.plural}`}</span></div>{navigationActive?<div className="route-plan-driving-buttons"><button type="button" onClick={()=>void toggleNavigation()}>{copy.exit}</button><button type="button" className={`arrived${nearDestination?' is-near':''}`} onClick={()=>window.dispatchEvent(new CustomEvent('routehub:arrival',{detail:{manual:true,distance:destinationDistance}}))}><Flag size={19}/>{copy.arrived}</button></div>:<small>{maneuverInstruction(maneuver,locale)}</small>}</footer>
 </section>
}
