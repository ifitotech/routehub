'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import type {CSSProperties,PointerEvent as ReactPointerEvent} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {ArrowUp,CornerUpLeft,CornerUpRight,Crosshair,Flag,LocateFixed,RotateCcw,Route as RouteIcon,Satellite,WifiOff} from 'lucide-react'
import {mapTileConfig} from '../lib/maps/map-config'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute,distanceMeters,nextRouteManeuver,remainingRouteDistance} from '../lib/maps/routing'
import type {ActiveRouteManeuver} from '../lib/maps/types'

type Coordinate={lat:number;lng:number}
type GpsFix=Coordinate&{accuracy:number;updatedAt:number;heading:number|null}
export type PlannedStop={id:string;address?:string|null;label?:string|null;kind?:'pickup'|'delivery'|'branch';orderNumber?:string|null;notes?:string|null;position?:number;pastDue?:boolean;pending?:boolean}

type Props={originAddress?:string|null;stops:PlannedStop[];locale?:string;navigationOnly?:boolean;autoStartNavigation?:boolean;onReturnToday?:()=>void;onExitNavigation?:()=>void;onArrive?:()=>void|Promise<void>;transitioningOut?:boolean}

function bearingBetween(from:Coordinate,to:Coordinate){
 const radians=Math.PI/180
 const y=Math.sin((to.lng-from.lng)*radians)*Math.cos(to.lat*radians)
 const x=Math.cos(from.lat*radians)*Math.sin(to.lat*radians)-Math.sin(from.lat*radians)*Math.cos(to.lat*radians)*Math.cos((to.lng-from.lng)*radians)
 return (Math.atan2(y,x)/radians+360)%360
}

function smoothHeading(previous:number|null,next:number|null){
 if(next==null)return previous
 if(previous==null)return next
 // Interpolate on a circle so a change from 359° to 1° remains a small turn.
 const delta=((next-previous+540)%360)-180
 return (previous+delta*.42+360)%360
}

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
 if(!maneuver)return locale==='es'?'Continúa por la ruta':locale==='fr'?'Continuez sur l’itinéraire':'Continue on route'
 const street=maneuver.streetName?.trim()
 const modifier=maneuver.modifier||''
 const type=maneuver.type||''
 if(locale==='es'){
  if(type==='arrive')return street?`Llegarás a ${street}`:'Llegarás al destino'
  if(type.includes('roundabout')||type==='rotary')return street?`En la rotonda, toma la salida hacia ${street}`:'Entra en la rotonda'
  if(modifier.includes('u-turn'))return street?`Haz un retorno hacia ${street}`:'Haz un retorno'
  if(modifier.includes('left'))return street?`Gira a la izquierda en ${street}`:'Gira a la izquierda'
  if(modifier.includes('right'))return street?`Gira a la derecha en ${street}`:'Gira a la derecha'
  if(type==='depart')return street?`Continúa por ${street}`:'Inicia el recorrido'
  return street?`Continúa por ${street}`:'Continúa recto'
 }
 if(locale==='fr'){
  if(type==='arrive')return street?`Vous arrivez à ${street}`:'Vous arrivez à destination'
  if(type.includes('roundabout')||type==='rotary')return street?`Au rond-point, prenez la sortie vers ${street}`:'Entrez dans le rond-point'
  if(modifier.includes('u-turn'))return street?`Faites demi-tour vers ${street}`:'Faites demi-tour'
  if(modifier.includes('left'))return street?`Tournez à gauche sur ${street}`:'Tournez à gauche'
  if(modifier.includes('right'))return street?`Tournez à droite sur ${street}`:'Tournez à droite'
  if(type==='depart')return street?`Continuez sur ${street}`:'Commencez le trajet'
  return street?`Continuez sur ${street}`:'Continuez tout droit'
 }
 return maneuver.instruction
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
  // Keep the camera slightly ahead of the vehicle so the active route stays
  // in front, like a driving GPS. This only moves the existing camera; the
  // Leaflet instance and its tiles remain mounted.
  const heading=location.heading
  const radians=Math.PI/180
  const aheadMeters=115
  const latOffset=heading==null?0:(Math.cos(heading*radians)*aheadMeters)/111_320
  const lngScale=Math.max(.2,Math.cos(location.lat*radians))
  const lngOffset=heading==null?0:(Math.sin(heading*radians)*aheadMeters)/(111_320*lngScale)
  map.panTo([location.lat+latOffset*.68,location.lng+lngOffset*.68],{animate:true,duration:.24})
  if(map.getZoom()<18)map.setZoom(18,{animate:false})
 },[map,location?.lat,location?.lng,location?.heading,enabled])
 return null
}

function CompactMapAttribution(){
 const map=useMap()
 useEffect(()=>{map.attributionControl.setPrefix(false)},[map])
 return null
}

const driverMarker=(heading:number|null)=>L.divIcon({
 className:'route-plan-driver-location',
 html:`<span class="route-plan-driver-arrow" style="--driver-heading:${Number.isFinite(heading)?heading:0}deg"><i></i></span>`,
 iconSize:[48,48],iconAnchor:[24,24]
})

export default function RoutePlanMap({originAddress,stops,locale='en',navigationOnly=false,autoStartNavigation=false,onReturnToday,onExitNavigation,onArrive,transitioningOut=false}:Props){
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
 const [sheetExpanded,setSheetExpanded]=useState(false)
 const [sheetDragY,setSheetDragY]=useState(0)
 const [offRoute,setOffRoute]=useState(false)
 const [rerouting,setRerouting]=useState(false)
 const [online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine)
 const wakeLock=useRef<any>(null)
 const lastReroute=useRef(0)
 const navigationTarget=useRef('')
 const arrivalNotified=useRef(false)
 const acceptedGpsFix=useRef<GpsFix|null>(null)
 const navigationRequest=useRef(0)
 const sheetDragStart=useRef<number|null>(null)
 const sheetTouchStart=useRef<{x:number;y:number}|null>(null)
 const [loading,setLoading]=useState(true)
 const [arrivalReady,setArrivalReady]=useState(false)
 const [arrivalConfirmed,setArrivalConfirmed]=useState(false)
 const didAutoStart=useRef(false)
 const validStops=useMemo(()=>stops.filter(stop=>Boolean(stop.id||stop.address||stop.label)),[stops])
 // Driver navigation shows the active stop and only one upcoming reference.
 // The driver page sorts active work first before passing these stops.
 const navigationStops=useMemo(()=>validStops.slice(0,2),[validStops])
 const displayedStops=view==='navigate'?navigationStops:validStops
 const addressKey=[originAddress,...displayedStops.map(stop=>stop.address)].filter(Boolean).join('\u001f')
 const routeCacheKey=`routehub-navigation-cache:${addressKey}:${view}`

 useEffect(()=>{
  // A completed stop changes the target without remounting the map. Invalidate
  // in-flight work so an older route can never replace the next stop's route.
  navigationTarget.current=''
  navigationRequest.current+=1
  setArrivalReady(false)
  setArrivalConfirmed(false)
  arrivalNotified.current=false
 },[navigationStops[0]?.id])

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
  const watch=navigator.geolocation.watchPosition(position=>{
   const updatedAt=Date.now()
   const raw={lat:position.coords.latitude,lng:position.coords.longitude}
   const previous=acceptedGpsFix.current
   const reportedHeading=Number.isFinite(position.coords.heading)?position.coords.heading:null
   // iOS Safari frequently reports a null heading for web geolocation. Use
   // the last accepted movement as a conservative fallback so the camera can
   // still face forward while driving.
   const movementHeading=previous&&distanceMeters(previous,raw)>=4?bearingBetween(previous,raw):previous?.heading??null
   const candidate={...raw,accuracy:position.coords.accuracy,heading:smoothHeading(previous?.heading??null,reportedHeading??movementHeading),updatedAt}
   // Do not let a weak fix pull the marker across parallel roads or cause a
   // false reroute. A normal driving movement is still always accepted.
   const elapsedSeconds=previous?Math.max(1,(updatedAt-previous.updatedAt)/1000):0
   const distance=previous?distanceMeters(previous,candidate):0
   // A new position with a much smaller accuracy circle is allowed to correct
   // an earlier coarse fix, even if that correction is several streets away.
   const materiallyMorePrecise=Boolean(previous&&candidate.accuracy+15<previous.accuracy)
   const allowedTravel=Math.max(40,elapsedSeconds*45+(candidate.accuracy+(previous?.accuracy||0))*1.5)
   const muchWorseThanPrevious=Boolean(previous&&candidate.accuracy>Math.max(75,previous.accuracy*1.8))
   if(previous&&((muchWorseThanPrevious&&!materiallyMorePrecise)||(distance>allowedTravel&&!materiallyMorePrecise)))return
   acceptedGpsFix.current=candidate
   setGpsError(false)
   setDeviceLocation(candidate)
  },()=>setGpsError(true),{enableHighAccuracy:true,maximumAge:0,timeout:12_000})
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
  const request=++navigationRequest.current
  void calculateRoute([deviceLocation,target]).then(next=>{
   if(request===navigationRequest.current&&next.coordinates.length>1){setLine(next.coordinates);setEstimate(next)}
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
 const startNavigation=async()=>{
  if(navigationActive)return
  try{wakeLock.current=await (navigator as any).wakeLock?.request?.('screen')}catch{}
  setNavigationActive(true)
  setSheetExpanded(false)
  setSheetDragY(0)
  window.setTimeout(()=>{map?.invalidateSize();if(deviceLocation)map?.setView([deviceLocation.lat,deviceLocation.lng],17,{animate:false})},60)
 }
 const stopNavigation=async()=>{
  if(!navigationActive)return
  await wakeLock.current?.release?.()
  wakeLock.current=null
  setNavigationActive(false)
  setSheetExpanded(false)
  setSheetDragY(0)
 }
 const toggleNavigation=async()=>{
  if(navigationActive){await stopNavigation();return}
  await startNavigation()
 }
 const exitNavigation=async()=>{
  await stopNavigation()
  if(onExitNavigation){onExitNavigation();return}
  onReturnToday?.()
 }
 const confirmArrival=async()=>{
  if(!nearDestination||arrivalConfirmed)return
  setArrivalConfirmed(true)
  try{
   if(onArrive){await onArrive();return}
   window.dispatchEvent(new CustomEvent('routehub:arrival',{detail:{manual:true,distance:destinationDistance}}))
   onReturnToday?.()
  }catch{
   setArrivalConfirmed(false)
  }
 }

 useEffect(()=>{
  if(!autoStartNavigation||navigationActive||didAutoStart.current)return
  didAutoStart.current=true
  void startNavigation()
 },[autoStartNavigation,navigationActive])

 const beginSheetDrag=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  sheetDragStart.current=event.clientY
  event.currentTarget.setPointerCapture(event.pointerId)
 }
 const moveSheet=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  if(sheetDragStart.current==null)return
  const delta=event.clientY-sheetDragStart.current
  setSheetDragY(Math.max(-90,Math.min(90,delta)))
 }
 const finishSheetDrag=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  if(sheetDragStart.current==null)return
  const delta=event.clientY-sheetDragStart.current
  sheetDragStart.current=null
  setSheetDragY(0)
  if(delta<-45&&onReturnToday){onReturnToday();return}
  if(delta<-30)setSheetExpanded(true)
  else if(delta>30)setSheetExpanded(false)
  else setSheetExpanded(value=>!value)
 }
 const beginSheetTouch=(event:React.TouchEvent<HTMLElement>)=>{
  const touch=event.touches[0]
  if(touch)sheetTouchStart.current={x:touch.clientX,y:touch.clientY}
 }
 const finishSheetTouch=(event:React.TouchEvent<HTMLElement>)=>{
  const start=sheetTouchStart.current
  sheetTouchStart.current=null
  const touch=event.changedTouches[0]
  if(!start||!touch){setSheetDragY(0);return}
  const dx=touch.clientX-start.x,dy=touch.clientY-start.y
  setSheetDragY(0)
  if(dy<-70&&Math.abs(dy)>Math.abs(dx)*1.2&&onReturnToday)onReturnToday()
 }
 const moveSheetTouch=(event:React.TouchEvent<HTMLElement>)=>{
  const start=sheetTouchStart.current,touch=event.touches[0]
  if(start&&touch)setSheetDragY(Math.max(-90,Math.min(0,touch.clientY-start.y)))
 }

 useEffect(()=>{
  if(view!=='navigate'||!deviceLocation||line.length<2||!points.length)return
  const nearest=remainingRouteDistance(line,deviceLocation).distanceFromRouteMeters
  setOffRoute(nearest>=150)
  if(nearest<85||Date.now()-lastReroute.current<8_000||!online)return
  const nextStop=points[1]||points[0]
  lastReroute.current=Date.now()
  setRerouting(true)
  const request=++navigationRequest.current
  void calculateRoute([deviceLocation,nextStop]).then(next=>{if(request===navigationRequest.current&&next.coordinates.length>1){setLine(next.coordinates);setEstimate(next);setOffRoute(false)}}).finally(()=>{if(request===navigationRequest.current)setRerouting(false)})
 },[view,deviceLocation?.lat,deviceLocation?.lng,line,points,online])

 useEffect(()=>{
  if(!deviceLocation||!points.length)return
  const target=points[1]||points[0]
  const radians=Math.PI/180
  const dLat=(target.lat-deviceLocation.lat)*radians,dLng=(target.lng-deviceLocation.lng)*radians
  const a=Math.sin(dLat/2)**2+Math.cos(deviceLocation.lat*radians)*Math.cos(target.lat*radians)*Math.sin(dLng/2)**2
  const distance=2*6371000*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
  if(distance<75&&!arrivalNotified.current){arrivalNotified.current=true;setArrivalReady(true)}
  if(distance>=100){arrivalNotified.current=false;setArrivalReady(false)}
 },[deviceLocation?.lat,deviceLocation?.lng,points])

 const center=points[0]||{lat:39.8283,lng:-98.5795}
 const maneuver=useMemo(()=>nextRouteManeuver(estimate?.maneuvers,line,deviceLocation),[deviceLocation?.lat,deviceLocation?.lng,estimate?.maneuvers,line])
 const routeProgress=useMemo(()=>remainingRouteDistance(line,deviceLocation),[line,deviceLocation?.lat,deviceLocation?.lng])
 const destination=points[1]||points[0]
 const destinationDistance=deviceLocation&&destination?distanceMeters(deviceLocation,destination):undefined
 const nearDestination=arrivalReady||(Number.isFinite(destinationDistance)&&destinationDistance!<75)
 const remainingDistance=deviceLocation&&line.length>1?routeProgress.distanceMeters:estimate?.distanceMeters
 const remainingDuration=remainingDistance!=null&&estimate?.distanceMeters&&estimate.durationSeconds?Math.max(30,estimate.durationSeconds*(remainingDistance/estimate.distanceMeters)):estimate?.durationSeconds
 const gpsWeak=Boolean(gpsError||!deviceLocation||deviceLocation.accuracy>75||gpsClock-deviceLocation.updatedAt>20_000)
 const gpsMeta=deviceLocation?`${Math.round(deviceLocation.accuracy)} m · ${Math.max(0,Math.round((gpsClock-deviceLocation.updatedAt)/1000))} s`:''
 const copy=locale==='es'?{label:'Mapa de navegación',loading:'Preparando el recorrido…',unavailable:'No pudimos ubicar las paradas todavía.',map:'Navegación',stop:'Parada',single:'parada programada',plural:'paradas programadas',complete:'Vista completa',next:'Próxima parada',pastDue:'Atrasada · Pendiente',pending:'Pendiente',gps:'GPS activo',gpsWeak:'Señal GPS débil',gpsLost:'Sin señal GPS',recenter:'Recentrar',exit:'Salir',arrived:'Llegué',arrivalConfirmed:'Llegada confirmada',rerouting:'Recalculando ruta…',offRoute:'Fuera de ruta',offline:'Sin conexión · usando la última ruta'}:locale==='fr'?{label:'Carte de navigation',loading:'Préparation du trajet…',unavailable:'Nous ne pouvons pas encore localiser les arrêts.',map:'Navigation',stop:'Arrêt',single:'arrêt programmé',plural:'arrêts programmés',complete:'Itinéraire complet',next:'Prochain arrêt',pastDue:'En retard · En attente',pending:'En attente',gps:'GPS actif',gpsWeak:'Signal GPS faible',gpsLost:'Signal GPS indisponible',recenter:'Recentrer',exit:'Quitter',arrived:'Arrivé',arrivalConfirmed:'Arrivée confirmée',rerouting:'Recalcul de l’itinéraire…',offRoute:'Hors itinéraire',offline:'Hors ligne · dernier itinéraire utilisé'}:{label:'Navigation map',loading:'Preparing route…',unavailable:'We could not locate these stops yet.',map:'Navigation',stop:'Stop',single:'scheduled stop',plural:'scheduled stops',complete:'Full route view',next:'Next stop',pastDue:'Past due · Pending',pending:'Pending',gps:'GPS active',gpsWeak:'Weak GPS signal',gpsLost:'GPS signal unavailable',recenter:'Re-center',exit:'Exit',arrived:'Arrived',arrivalConfirmed:'Arrival confirmed',rerouting:'Rerouting…',offRoute:'Off route',offline:'Offline · using last route'}
 const activeStop=navigationStops[0]
 const followingStop=navigationStops[1]
 const stopKindLabel=(kind:PlannedStop['kind'])=>kind==='pickup'?(locale==='es'?'Recogida':locale==='fr'?'Collecte':'Pickup'):kind==='branch'?(locale==='es'?'Regresar a sucursal':locale==='fr'?'Retour à la succursale':'Return to branch'):(locale==='es'?'Entrega':locale==='fr'?'Livraison':'Delivery')
 return <section className={`route-plan-map route-plan-${view}${driverMode?' route-plan-driver':''}${navigationActive?' is-driving':''}${sheetExpanded?' is-sheet-expanded':''}${transitioningOut?' is-returning-today':''}`} aria-label={copy.label}>
  <header className="route-plan-nav"><div><small className={view==='navigate'&&(activeStop?.pastDue||activeStop?.pending)?'route-plan-overdue':''}>{view==='navigate'?(activeStop?.pastDue?copy.pastDue:activeStop?.pending?copy.pending:copy.next):copy.complete}</small><strong>{view==='navigate'?(navigationStops[0]?.label||navigationStops[0]?.address||copy.stop):`${validStops.length} ${validStops.length===1?copy.single:copy.plural}`}</strong></div><span className={deviceLocation&&!gpsWeak?'is-live':''}>{gpsWeak?(deviceLocation?copy.gpsWeak:copy.gpsLost):copy.gps}{deviceLocation&&<small> · {gpsMeta}</small>}</span></header>
  {!driverMode&&<div className="route-plan-tabs"><button className={view==='navigate'?'active':''} onClick={()=>setView('navigate')}>{locale==='es'?'Navegar':locale==='fr'?'Naviguer':'Navigate'}</button><button className={view==='plan'?'active':''} onClick={()=>setView('plan')}>{locale==='es'?'Plan':locale==='fr'?'Plan':'Plan'}</button></div>}
  {view==='navigate'&&navigationActive&&<div className="route-plan-guide" aria-live="polite"><ManeuverIcon maneuver={maneuver}/><div><b>{formatDistance(maneuver?.distanceToManeuverMeters)}</b><span>{maneuverInstruction(maneuver,locale)}</span></div></div>}
  {view==='navigate'&&navigationActive&&(rerouting||offRoute||!online)&&<div className={`route-plan-driving-alert${rerouting||offRoute?' is-warning':''}`}>{!online?<WifiOff size={16}/>:<RouteIcon size={16}/>}<span>{!online?copy.offline:rerouting?copy.rerouting:copy.offRoute}</span></div>}
  <div className="route-plan-canvas">{loading?<div className="live-route-loading">{copy.loading}</div>:!points.length?<div className="live-route-loading">{copy.unavailable}</div>:<MapContainer ref={setMap} center={[center.lat,center.lng]} zoom={11} scrollWheelZoom={false} aria-label={copy.map}>
   <CompactMapAttribution/>
   <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
   <Fit points={points}/>
   <FollowDriver location={deviceLocation} enabled={view==='navigate'&&navigationActive}/>
   {line.length>1&&<Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#176bf2',weight:navigationActive?7:5,opacity:.96,lineCap:'round',lineJoin:'round'}}/>}
   {points.slice(1).map((point,index)=><Marker key={displayedStops[index]?.id||index} position={[point.lat,point.lng]} icon={marker(index+1,index===0)}><Tooltip direction="top" offset={[0,-18]}>{displayedStops[index]?.label||`${copy.stop} ${index+1}`}</Tooltip></Marker>)}
   {deviceLocation&&<Marker position={[deviceLocation.lat,deviceLocation.lng]} icon={driverMarker(deviceLocation.heading)}><Tooltip direction="top">{locale==='es'?'Tu ubicación':locale==='fr'?'Votre position':'Your location'}</Tooltip></Marker>}
  </MapContainer>} {deviceLocation&&<>{!navigationActive&&<button className="route-plan-recenter" type="button" onClick={()=>map?.setView([deviceLocation.lat,deviceLocation.lng],15)}><LocateFixed size={20}/><span>{copy.recenter}</span></button>}{navigationActive&&<><div className={`route-plan-gps-pill${gpsWeak?' is-weak':''}`}><Satellite size={16}/><span>{gpsWeak?(deviceLocation?copy.gpsWeak:copy.gpsLost):copy.gps}</span></div><div className="route-plan-float-controls"><button type="button" aria-label={copy.recenter} onClick={()=>map?.setView([deviceLocation.lat,deviceLocation.lng],17)}><Crosshair size={23}/></button></div></>}</>}</div>
  <footer className="route-plan-bottom" style={{'--route-sheet-drag':`${sheetDragY}px`} as CSSProperties} onTouchStart={navigationActive?beginSheetTouch:undefined} onTouchMove={navigationActive?moveSheetTouch:undefined} onTouchEnd={navigationActive?finishSheetTouch:undefined}>{navigationActive&&<button type="button" className="route-plan-sheet-handle" aria-label={sheetExpanded?(locale==='es'?'Bajar detalles':locale==='fr'?'Réduire les détails':'Collapse details'):(locale==='es'?'Subir detalles':locale==='fr'?'Afficher les détails':'Expand details')} onPointerDown={beginSheetDrag} onPointerMove={moveSheet} onPointerUp={finishSheetDrag} onPointerCancel={()=>{sheetDragStart.current=null;setSheetDragY(0)}}><span/></button>}<div className="route-plan-summary"><strong>{remainingDuration!=null?`${Math.max(1,Math.round(remainingDuration/60))} min`:`${navigationActive?'' : validStops.length}`}</strong><span>{remainingDistance!=null?`${formatDistance(remainingDistance)} · ${new Date(Date.now()+(remainingDuration||0)*1000).toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'})}`:`${validStops.length===1?copy.single:copy.plural}`}</span></div>{navigationActive&&sheetExpanded&&<div className="route-plan-sheet-details"><small>{locale==='es'?'Parada actual':locale==='fr'?'Arrêt actuel':'Current stop'}</small><div className="route-plan-sheet-stop"><b>{activeStop?.position||1}</b><span><strong>{activeStop?.label||activeStop?.address||copy.stop}</strong><em>{activeStop?.address}</em></span><i>{stopKindLabel(activeStop?.kind)}</i></div>{activeStop?.orderNumber&&<p><b>PO / ORDER</b><span>{activeStop.orderNumber}</span></p>}{activeStop?.notes&&<p><b>{locale==='es'?'Instrucciones':locale==='fr'?'Instructions':'Instructions'}</b><span>{activeStop.notes}</span></p>}{followingStop&&<><small>{locale==='es'?'Siguiente parada':locale==='fr'?'Prochain arrêt':'Next stop'}</small><div className="route-plan-sheet-stop is-next"><b>{followingStop.position||2}</b><span><strong>{followingStop.label||followingStop.address}</strong><em>{followingStop.address}</em></span><i>{stopKindLabel(followingStop.kind)}</i></div></>}</div>}{navigationActive?<div className="route-plan-driving-buttons"><button type="button" onClick={()=>void exitNavigation()}>{copy.exit}</button><button type="button" disabled={!nearDestination||arrivalConfirmed} className={`arrived${nearDestination?' is-near':''}`} onClick={()=>void confirmArrival()}><Flag size={19}/>{arrivalConfirmed?copy.arrivalConfirmed:copy.arrived}</button></div>:<small>{maneuverInstruction(maneuver,locale)}</small>}</footer>
 </section>
}
