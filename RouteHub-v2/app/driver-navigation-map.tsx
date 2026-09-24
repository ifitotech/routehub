'use client'

import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {ArrowUp,Box,Clock,CornerUpLeft,CornerUpRight,Flag,LocateFixed,LogOut,MapPin,Navigation,PackageCheck,RotateCcw,Volume2,VolumeX} from 'lucide-react'
import GoogleRouteCanvas from '../components/google-route-canvas'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute,distanceMeters} from '../lib/maps/routing'
import {clusterCoordinates,sanitizeCoordinate} from '../lib/maps/coordinates'
import type {RouteEstimate} from '../lib/maps/types'
import {distanceFromNavigationPath,usableNavigationFix,projectNavigationPosition,navigationManeuver,navigationRemainingSeconds,type NavigationProgress} from '../lib/maps/navigation-progress'
import {reportAppError} from '../lib/error-reporting'
import {openNavigationWithFallback} from '../lib/maps/external-navigation'
import {resolvedTheme,themePreference} from '../lib/use-preferences'
import styles from './driver-navigation.module.css'

type Coordinate={lat:number;lng:number}
type GpsFix=Coordinate&{accuracy:number;updatedAt:number;heading:number|null}
type SharedGpsFix=Coordinate&{accuracy?:number;heading?:number|null;at?:string}
export type PlannedStop={id:string;address?:string|null;label?:string|null;kind?:'pickup'|'delivery'|'branch';orderNumber?:string|null;notes?:string|null;position?:number;pastDue?:boolean;pending?:boolean;coordinate?:Coordinate|null}

// Google's Routes API returns one combined sentence ("Turn right onto NW
// 151st Terrace") with no separate street-name field. The approved design
// splits distance / street / action onto three lines, so this heuristically
// lifts the street name out of the sentence for display only - it never
// changes what is spoken by voice guidance or what reaches routing logic.
// When no pattern matches, callers fall back to the untouched sentence
// instead of guessing, so nothing shown is invented.
const STREET_SPLIT_PATTERNS:Record<string,RegExp[]>={
  es:[/\b(?:hacia|por|en)\s+(.+)$/i],
  fr:[/\b(?:sur|vers)\s+(.+)$/i],
  en:[/\bonto\s+(.+)$/i,/\btoward\s+(.+)$/i,/\bon\s+(.+)$/i],
}
function splitStreetName(instruction:string|null|undefined,locale:string):string|null{
  if(!instruction)return null
  for(const pattern of STREET_SPLIT_PATTERNS[locale]||STREET_SPLIT_PATTERNS.en){
    const match=instruction.match(pattern)
    if(match?.[1])return match[1].trim().replace(/[.\s]+$/,'')
  }
  return null
}

// Localizes Google's maneuver type code (e.g. "TURN_RIGHT") into a short
// verb phrase for the card's action line. Returns null for an unrecognized
// or missing type rather than guessing, so the caller can fall back to the
// full instruction sentence instead of showing a made-up action.
function maneuverActionLabel(type:string|null|undefined,locale:string):string|null{
  if(!type)return null
  const t=type.toUpperCase()
  const pick=(en:string,es:string,fr:string)=>locale==='es'?es:locale==='fr'?fr:en
  if(t.includes('UTURN'))return pick('Make a U-turn','Haz un cambio de sentido','Faites demi-tour')
  if(t.includes('SHARP_LEFT'))return pick('Sharp left','Giro cerrado a la izquierda','Virage serré à gauche')
  if(t.includes('SHARP_RIGHT'))return pick('Sharp right','Giro cerrado a la derecha','Virage serré à droite')
  if(t.includes('SLIGHT_LEFT'))return pick('Slight left','Leve a la izquierda','Légèrement à gauche')
  if(t.includes('SLIGHT_RIGHT'))return pick('Slight right','Leve a la derecha','Légèrement à droite')
  if(t.includes('LEFT'))return pick('Turn left','Gira a la izquierda','Tournez à gauche')
  if(t.includes('RIGHT'))return pick('Turn right','Gira a la derecha','Tournez à droite')
  if(t.includes('ROUNDABOUT'))return pick('Take the roundabout','Toma la rotonda','Prenez le rond-point')
  if(t.includes('MERGE'))return pick('Merge','Incorpórate','Insérez-vous')
  if(t.includes('FORK'))return pick('Keep at the fork','Mantente en la bifurcación','Restez à la bifurcation')
  if(t.includes('RAMP'))return pick('Take the ramp','Toma la rampa','Prenez la bretelle')
  if(t.includes('FERRY'))return pick('Take the ferry','Toma el ferry','Prenez le ferry')
  if(t.includes('STRAIGHT')||t.includes('DEPART')||t.includes('CONTINUE'))return pick('Continue straight','Sigue derecho','Continuez tout droit')
  return null
}

function maneuverIconFor(type:string|null|undefined){
  const t=(type||'').toUpperCase()
  if(t.includes('UTURN'))return RotateCcw
  if(t.includes('LEFT'))return CornerUpLeft
  if(t.includes('RIGHT'))return CornerUpRight
  return ArrowUp
}

type Props={
  originAddress?:string|null
  originCoordinate?:Coordinate|null
  stops:PlannedStop[]
  locale?:string
  navigationOnly?:boolean
  autoStartNavigation?:boolean
  onReturnToday?:()=>void
  onExitNavigation?:()=>void
  onArrive?:()=>void|Promise<void>
  transitioningOut?:boolean
  trackDevice?:boolean
  sharedLocation?:SharedGpsFix|null
  arrivalDisabled?:boolean
  stopNumber?:number
  stopTotal?:number
  // Lets the parent (page.tsx) drive a live drag-to-close transition back
  // to Today using this same handle, in addition to its own existing
  // tap-to-expand behavior. onHandleDrag reports the raw pointer delta in
  // px (negative = dragged up) once a genuine upward drag is recognized;
  // the parent owns deciding the resulting animation, this component only
  // reports the gesture.
  onHandleDragStart?:()=>void
  onHandleDrag?:(deltaY:number)=>void
  onHandleDragEnd?:()=>void
}

export default function DriverNavigationMap({
  originAddress,
  originCoordinate=null,
  stops,
  locale='en',
  navigationOnly=false,
  autoStartNavigation=false,
  onReturnToday,
  onExitNavigation,
  onArrive,
  trackDevice=true,
  sharedLocation=null,
  arrivalDisabled=false,
  stopNumber,
  stopTotal,
  onHandleDragStart,
  onHandleDrag,
  onHandleDragEnd,
}:Props){
  const [points,setPoints]=useState<Coordinate[]>([])
  const [line,setLine]=useState<Coordinate[]>([])
  const [estimate,setEstimate]=useState<RouteEstimate|null>(null)
  const [deviceLocation,setDeviceLocation]=useState<GpsFix|null>(null)
  const [loading,setLoading]=useState(true)
  const [arriving,setArriving]=useState(false)
  // Persisted per device instead of resetting to off every time navigation
  // opens - a driver who turns voice guidance on once should not have to
  // find and tap it again on every single stop.
  const [voiceEnabled,setVoiceEnabled]=useState(()=>{
    if(typeof window==='undefined')return false
    try{return window.localStorage.getItem('routehub:nav-voice')==='on'}catch{return false}
  })
  const toggleVoice=()=>setVoiceEnabled(current=>{
    const next=!current
    try{window.localStorage.setItem('routehub:nav-voice',next?'on':'off')}catch{}
    return next
  })
  const [followToken,setFollowToken]=useState(0)
  const watchRef=useRef<number|null>(null)
  const wakeLock=useRef<{release?:()=>Promise<void>}|null>(null)
  const lastSpokenInstruction=useRef('')
  const [rerouteToken,setRerouteToken]=useState(0)
  const lastReroute=useRef(0)
  const offRouteFixes=useRef(0)
  const loadedRouteKey=useRef('')
  const hadAccurateLocation=useRef(false)
  const lastCheckedFix=useRef<number|null>(null)
  const [clock,setClock]=useState(Date.now)
  const [routing,setRouting]=useState(false)
  const [cameraMode,setCameraMode]=useState<'follow'|'overview'|'explore'>('follow')
  const [progress,setProgress]=useState<NavigationProgress|null>(null)
  const progressRef=useRef<{line:Coordinate[];value:NavigationProgress;at:number}|null>(null)
  const [destinations,setDestinations]=useState<Array<Coordinate|null>>([])
  const [gpsMessage,setGpsMessage]=useState('')
  const [foregroundGps,setForegroundGps]=useState(false)
  // Bottom sheet expand/collapse - purely visual, does not affect routing,
  // GPS tracking or the map's own camera/fit logic below.
  const [sheetExpanded,setSheetExpanded]=useState(false)
  // Disambiguates a plain tap (toggle sheetExpanded, existing behavior) from
  // a real upward drag (report to the parent's Today transition) on the
  // same handle. "engaged" only flips once the drag clearly moved upward
  // past a small threshold, and once engaged every further move (even back
  // downward) keeps reporting so the parent's live progress stays accurate
  // if the driver drags partway then lets it settle back.
  const handleDragRef=useRef<{y:number;engaged:boolean;moved:boolean}|null>(null)
  // Google Maps does not inherit CSS colors. Keep the real map palette in
  // sync with the resolved RouteHub/system theme instead of only darkening
  // the controls that sit on top of it.
  const [mapTheme,setMapTheme]=useState<'light'|'dark'>('dark')

  useEffect(()=>{
    // The rendered app theme is the source of truth for this portal. Driver
    // navigation lives under document.body (outside the Driver root), so a
    // stale localStorage preference here could otherwise make the map and
    // its cards light while the visible app is dark. Fall back to storage
    // only before the app has applied its theme to <html>.
    const syncTheme=()=>{
      const applied=document.documentElement.dataset.theme
      setMapTheme(applied==='light'||applied==='dark'?applied:resolvedTheme(themePreference()))
    }
    syncTheme()
    const observer=new MutationObserver(syncTheme)
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})
    window.addEventListener('routehub:theme-change',syncTheme)
    return()=>{observer.disconnect();window.removeEventListener('routehub:theme-change',syncTheme)}
  },[])

  const validStops=useMemo(()=>stops.filter(stop=>Boolean(stop.id||stop.address||stop.label||stop.coordinate)),[stops])
  const safeOrigin=sanitizeCoordinate(originCoordinate)
  const routeKey=useMemo(()=>[
    originAddress||'',
    !navigationOnly&&safeOrigin?`${safeOrigin.lat},${safeOrigin.lng}`:'',
    ...validStops.map(stop=>`${stop.id}:${stop.address||''}:${stop.coordinate?.lat||''}:${stop.coordinate?.lng||''}`),
  ].join('|'),[originAddress,safeOrigin,validStops,navigationOnly])
  // GPS availability triggers the initial route; subsequent fixes move the
  // marker. Only confirmed deviation or a changed destination reroutes.
  const sharedLocationKey=usableNavigationFix(deviceLocation,clock)
  const routingInput=useRef({originAddress,safeOrigin,validStops,sharedLocation,deviceLocation})
  routingInput.current={originAddress,safeOrigin,validStops,sharedLocation,deviceLocation}

  useEffect(()=>{
    let cancelled=false
    // Losing GPS pauses guidance; it must not replace a good route with one
    // starting at an old location saved by the server.
    const lostGps=hadAccurateLocation.current&&!sharedLocationKey
    hadAccurateLocation.current=sharedLocationKey
    if(lostGps&&loadedRouteKey.current===routeKey)return
    setRouting(true)
    const {originAddress,safeOrigin,validStops,deviceLocation}=routingInput.current
    if(loadedRouteKey.current!==routeKey){
      loadedRouteKey.current=routeKey
      setLine([])
      setEstimate(null)
      setLoading(true)
    }
    const known:Array<{address?:string|null;coordinate?:Coordinate|null}>=[
      {address:originAddress,coordinate:safeOrigin},
      ...validStops.map(stop=>({address:stop.address,coordinate:sanitizeCoordinate(stop.coordinate)})),
    ]
    Promise.all(known.map(async item=>{
      const stored=sanitizeCoordinate(item.coordinate)
      if(stored)return stored
      if(!item.address)return null
      try{return sanitizeCoordinate((await geocodeAddress(item.address))?.coordinate||null)}catch{return null}
    })).then(async resolved=>{
      if(cancelled)return
      const coordinates=clusterCoordinates(resolved)
      setPoints(coordinates)
      setDestinations(resolved.slice(1))
      setLoading(false)
      const start=usableNavigationFix(deviceLocation,Date.now())?sanitizeCoordinate(deviceLocation):null
      const rest=resolved.slice(1)
      // Do not silently skip an unresolved current destination and route to a
      // later stop. The assigned order remains authoritative.
      if(rest.some(point=>!point)){setEstimate(null);setLine([]);setRouting(false);return}
      // A saved origin belongs to the route plan, never to the driver. Until
      // foreground GPS gives us a fresh fix, keep the map as a destination
      // preview instead of drawing a blue route from where the driver was
      // earlier (or from the branch) and making it look like their location.
      if(!start||!rest.length){setEstimate(null);setLine([]);setRouting(false);return}
      // The saved origin must never become a waypoint behind the moving driver.
      lastReroute.current=Date.now()
      const estimate=await calculateRoute([start,...rest as Coordinate[]],undefined,locale,true)
      if(!cancelled){
        setEstimate(estimate)
        setRouting(false)
        // Preserve road geometry including repeated vertices at loops/U-turns.
        setLine(estimate.source==='google'?estimate.coordinates:[])
      }
    }).catch(routingError=>{
      if(cancelled)return
      setPoints([]);setLine([]);setEstimate(null);setLoading(false);setRouting(false)
      // Used to fail completely silently - a driver stuck with no route line
      // had no way to tell anyone beyond describing it after the fact.
      void reportAppError({action:'navigation_routing_failed',error:routingError,routeId:validStops[0]?.id})
    })
    return()=>{cancelled=true}
  },[routeKey,sharedLocationKey,locale,rerouteToken])

  useEffect(()=>{
    if(!usableNavigationFix(deviceLocation,clock)||!deviceLocation)return
    const previous=progressRef.current?.line===line?progressRef.current:null
    const maxAdvance=previous?Math.max(100,(deviceLocation.updatedAt-previous.at)/1000*55+deviceLocation.accuracy*2):250
    const next=projectNavigationPosition(deviceLocation,line,previous?.value.traveledMeters,maxAdvance)
    if(!next){setProgress(null);progressRef.current=null;return}
    // Never snap a driver from a parallel road onto this route or advance gray
    // progress while off route. Rerouting uses the original, unsnapped fix.
    if(next.distanceFromRoute>Math.min(40,Math.max(15,deviceLocation.accuracy)))return
    progressRef.current={line,value:next,at:deviceLocation.updatedAt}
    setProgress(next)
  },[deviceLocation,line,clock])

  useEffect(()=>{
    const fix=deviceLocation
    if(!fix||!usableNavigationFix(fix,Date.now())||routing||estimate?.source!=='google'||line.length<2)return
    if(lastCheckedFix.current===fix.updatedAt)return
    lastCheckedFix.current=fix.updatedAt
    // Distance to segments, rather than sparse vertices, avoids false reroutes
    // on long straight roads. Require three fixes and a 30-second cooldown.
    const nearest=distanceFromNavigationPath(fix,line)
    offRouteFixes.current=nearest>Math.max(60,fix.accuracy*2)?offRouteFixes.current+1:0
    if(offRouteFixes.current>=3&&Date.now()-lastReroute.current>30000){
      offRouteFixes.current=0
      lastReroute.current=Date.now()
      setRerouteToken(value=>value+1)
    }
  },[deviceLocation,estimate?.source,line,routing])

  useEffect(()=>{
    const timer=window.setInterval(()=>setClock(Date.now()),5000)
    const online=()=>{if(Date.now()-lastReroute.current>30000)setRerouteToken(value=>value+1)}
    const trafficTimer=window.setInterval(()=>{
      if(document.visibilityState==='visible'&&navigator.onLine&&usableNavigationFix(routingInput.current.deviceLocation,Date.now())&&Date.now()-lastReroute.current>=300000)setRerouteToken(value=>value+1)
    },30000)
    window.addEventListener('online',online)
    return()=>{window.clearInterval(timer);window.clearInterval(trafficTimer);window.removeEventListener('online',online)}
  },[])

  useEffect(()=>{
    if(!navigationOnly||!('wakeLock' in navigator))return
    let disposed=false
    let requesting=false
    const acquire=async()=>{
      if(disposed||requesting||document.visibilityState!=='visible')return
      requesting=true
      try{
        await wakeLock.current?.release?.()
        const lock=await navigator.wakeLock.request('screen')
        if(disposed)await lock.release()
        else wakeLock.current=lock
      }catch{/* Screen wake lock is optional and may be denied by the device. */}
      finally{requesting=false}
    }
    void acquire()
    document.addEventListener('visibilitychange',acquire)
    return()=>{disposed=true;document.removeEventListener('visibilitychange',acquire);void wakeLock.current?.release?.().catch(()=>undefined)}
  },[navigationOnly])

  const sharedLat=sharedLocation?.lat,sharedLng=sharedLocation?.lng,sharedAccuracy=sharedLocation?.accuracy,sharedAt=sharedLocation?.at,sharedHeading=sharedLocation?.heading
  useEffect(()=>{
    const next=sanitizeCoordinate({lat:sharedLat,lng:sharedLng})
    if(!next)return
    const fix={
      lat:next.lat,
      lng:next.lng,
      accuracy:Number.isFinite(sharedAccuracy)?Number(sharedAccuracy):Infinity,
      updatedAt:sharedAt?new Date(sharedAt).getTime():0,
      heading:sharedHeading??null,
    }
    setDeviceLocation(current=>current&&(fix.updatedAt<current.updatedAt||(!usableNavigationFix(fix,Date.now())&&usableNavigationFix(current,Date.now())))?current:fix)
  },[sharedLat,sharedLng,sharedAccuracy,sharedAt,sharedHeading])

  useEffect(()=>{
    if((!trackDevice&&!foregroundGps)||typeof navigator==='undefined'||!navigator.geolocation)return
    watchRef.current=navigator.geolocation.watchPosition(position=>{
      const next=sanitizeCoordinate({lat:position.coords.latitude,lng:position.coords.longitude})
      if(!next)return
      setDeviceLocation(previous=>{
        const accuracy=position.coords.accuracy
        const updatedAt=position.timestamp
        const materiallyMorePrecise=Boolean(previous&&Number.isFinite(accuracy)&&accuracy+15<previous.accuracy)
        const elapsedSeconds=previous?Math.max(1,(updatedAt-previous.updatedAt)/1000):0
        const moved=previous?distanceMeters(previous,next):0
        const allowedTravel=Math.max(40,elapsedSeconds*45+(accuracy+(previous?.accuracy||0))*1.5)
        const muchWorse=Boolean(previous&&accuracy>Math.max(75,previous.accuracy*1.8))
        if(previous&&((muchWorse&&!materiallyMorePrecise)||(moved>allowedTravel&&!materiallyMorePrecise)))return previous
        return {
          lat:next.lat,
          lng:next.lng,
          accuracy,
          updatedAt,
          heading:Number.isFinite(position.coords.heading)?position.coords.heading:null,
        }
      })
      setGpsMessage('')
    },error=>setGpsMessage(error.code===1?'permission':'unavailable'),{enableHighAccuracy:true,maximumAge:0,timeout:12_000})
    return()=>{
      if(watchRef.current!=null)navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current=null
    }
  },[trackDevice,foregroundGps])

  useEffect(()=>()=>{
    if(watchRef.current!=null&&typeof navigator!=='undefined')navigator.geolocation.clearWatch(watchRef.current)
    try{if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel()}catch{}
    void wakeLock.current?.release?.().catch(()=>undefined)
    wakeLock.current=null
  },[])

  const destination=destinations[0]
  const near=Boolean(deviceLocation&&destination&&distanceMeters(deviceLocation,destination)<75)
  const gpsReady=usableNavigationFix(deviceLocation,clock)
  const destinationOverview=useMemo(()=>destinations.filter((point):point is Coordinate=>Boolean(point)),[destinations])
  const onRoad=Boolean(gpsReady&&deviceLocation&&line.length>1&&distanceFromNavigationPath(deviceLocation,line)<=Math.min(40,Math.max(15,deviceLocation.accuracy)))
  const currentProgress=progressRef.current?.line===line?progress:null
  const matched=Boolean(onRoad&&deviceLocation&&currentProgress&&distanceMeters(deviceLocation,currentProgress.coordinate)<=Math.min(40,Math.max(15,deviceLocation.accuracy)))
  const guidanceReady=matched&&estimate?.source==='google'
  const nextManeuver=useMemo(()=>navigationManeuver(estimate?.maneuvers,currentProgress,estimate?.distanceMeters),[estimate?.maneuvers,currentProgress,estimate?.distanceMeters])
  const etaSeconds=guidanceReady?navigationRemainingSeconds(estimate?.durationSeconds,currentProgress):null
  const eta=Number.isFinite(etaSeconds)?Math.max(1,Math.round(Number(etaSeconds)/60)):null
  const formatDistance=useCallback((meters:number|undefined)=>{
    if(!Number.isFinite(meters))return ''
    const feet=Math.round(Number(meters)*3.28084)
    if(feet<1000)return locale==='es'?`${feet} pies`:locale==='fr'?`${feet} pi`:`${feet} ft`
    return `${(Number(meters)/1609.344).toFixed(Number(meters)>=16093.44?0:1)} mi`
  },[locale])
  const arrivalTime=Number.isFinite(etaSeconds)
    ?new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'2-digit'}).format(new Date(Date.now()+Number(etaSeconds)*1000))
      :''
  const remainingDistance=guidanceReady?formatDistance(currentProgress?.remainingMeters):''
  const copy=locale==='es'
    ?{loading:'Preparando el recorrido…',unavailable:'No pudimos ubicar las paradas todavía.',exit:'Salir',arrived:'Llegué',recenter:'Recentrar',eta:'Llegada estimada',traffic:'Tráfico',voiceOn:'Silenciar voz',voiceOff:'Activar voz',routeActive:'Ruta activa',after:'Después',openMaps:'Abrir Mapas',po:'PO',notes:'Notas',upcoming:'Próximas paradas',expand:'Ver más detalles',collapse:'Ver menos detalles'}
    :locale==='fr'
      ?{loading:'Préparation du trajet…',unavailable:'Nous ne pouvons pas encore localiser les arrêts.',exit:'Quitter',arrived:'Arrivé',recenter:'Recentrer',eta:'Arrivée estimée',traffic:'Trafic sur l’itinéraire',voiceOn:'Voix active',voiceOff:'Activer la voix',routeActive:'Itinéraire actif',after:'Ensuite',openMaps:'Ouvrir Plans',po:'PO',notes:'Notes',upcoming:'Arrêts suivants',expand:'Plus de détails',collapse:'Moins de détails'}
      :{loading:'Preparing route…',unavailable:'We could not locate these stops yet.',exit:'Exit',arrived:'Arrived',recenter:'Re-center',eta:'Estimated arrival',traffic:'Traffic on route',voiceOn:'Voice on',voiceOff:'Turn on voice',routeActive:'Route active',after:'Then',openMaps:'Open Maps',po:'PO',notes:'Notes',upcoming:'Upcoming stops',expand:'More details',collapse:'Fewer details'}
  // Never keep drawing/following a stale fix after GPS expires. The last
  // coordinate may still be useful as a route origin, but presenting it as
  // the driver's live position is misleading while guidance is paused.
  const displayLocation=gpsReady?(matched&&currentProgress?currentProgress.coordinate:deviceLocation):null
  const heading=matched&&currentProgress?currentProgress.heading:deviceLocation?.heading??null
  const markers=useMemo(()=>[
    ...destinations.map((point,index)=>({
      id:validStops[index]?.id||`stop-${index}`,
      position:point,
      label:String(index+1),
      title:validStops[index]?.label||validStops[index]?.address||`Stop ${index+1}`,
      tone:'#0F1D35',
    })),
    ...(displayLocation?[{id:'driver',position:displayLocation,label:'',title:locale==='es'?'Tu ubicación':locale==='fr'?'Votre position':'Your location',tone:'#FFFFFF',driver:true,heading}]:[]),
  ],[destinations,validStops,displayLocation,heading,locale])

  const confirmArrival=async()=>{
    if(arriving)return
    setArriving(true)
    try{
      if(onArrive){await onArrive();return}
      ;(onExitNavigation||onReturnToday)?.()
    }finally{
      setArriving(false)
    }
  }

  useEffect(()=>{
    if(typeof speechSynthesis==='undefined')return
    if(!voiceEnabled){speechSynthesis.cancel();lastSpokenInstruction.current='';return}
    if(!nextManeuver?.instruction||!guidanceReady||routing){speechSynthesis.cancel();return}
    const instruction=nextManeuver.instruction.trim()
    const distance=nextManeuver.distanceToManeuverMeters
    const stage=distance<=35?'now':distance<=180?'near':'ahead'
    const key=`${routeKey}:${lastReroute.current}:${nextManeuver.index}:${stage}`
    if(!instruction||lastSpokenInstruction.current===key)return
    lastSpokenInstruction.current=key
    speechSynthesis.cancel()
    const prefix=stage==='now'?(locale==='es'?'Ahora':locale==='fr'?'Maintenant':'Now'):`${locale==='es'?'En':locale==='fr'?'Dans':'In'} ${formatDistance(distance)}`
    const speech=new SpeechSynthesisUtterance(`${prefix}. ${instruction}`)
    speech.lang=locale==='es'?'es-US':locale==='fr'?'fr-FR':'en-US'
    speechSynthesis.speak(speech)
  },[voiceEnabled,nextManeuver,guidanceReady,routing,locale,routeKey,formatDistance])

  const labels=locale==='es'?{
    gps:'Buscando GPS preciso',permission:'Permite la ubicación precisa en los ajustes del navegador.',gpsHint:'La guía se pausó hasta recuperar una ubicación fiable.',enable:'Activar GPS',retry:'Reintentar',route:'Vista completa',follow:'Seguir',approx:'ETA aproximado',offRoute:'Comprobando el recorrido',noRoute:'Recorrido por calles no disponible',near:'Cerca del destino',destination:'Destino',now:'Ahora',distance:'Restante',arrival:'Llegada',paused:'Guía pausada',gpsAction:'Reintentar GPS',recalculating:'Recalculando ruta',calculating:'Calculando ruta…',waitingGps:'Esperando GPS',routeUnavailable:'Ruta no disponible',
  }:locale==='fr'?{
    gps:'Recherche GPS précis',permission:'Autorisez la position précise dans les réglages du navigateur.',gpsHint:'Guidage en pause jusqu’au retour d’une position fiable.',enable:'Activer GPS',retry:'Réessayer',route:'Vue du trajet',follow:'Suivre',approx:'ETA approximatif',offRoute:'Vérification du trajet',noRoute:'Trajet routier indisponible',near:'Destination proche',destination:'Destination',now:'Maintenant',distance:'Restant',arrival:'Arrivée',paused:'Guidage en pause',gpsAction:'Réessayer GPS',recalculating:'Recalcul de l’itinéraire',calculating:'Calcul de l’itinéraire…',waitingGps:'En attente du GPS',routeUnavailable:'Itinéraire indisponible',
  }:{
    gps:'Acquiring accurate GPS',permission:'Allow precise location in your browser settings.',gpsHint:'Guidance is paused until a reliable location returns.',enable:'Enable GPS',retry:'Retry',route:'Route overview',follow:'Follow',approx:'Approximate ETA',offRoute:'Checking route',noRoute:'Street route unavailable',near:'Near destination',destination:'Destination',now:'Now',distance:'Remaining',arrival:'Arrival',paused:'Guidance paused',gpsAction:'Retry GPS',recalculating:'Recalculating route',calculating:'Calculating route…',waitingGps:'Waiting for GPS',routeUnavailable:'Route unavailable',
  }
  const canGuide=guidanceReady&&!routing
  // A stable state machine instead of a chain of ternaries on `instruction` -
  // each state owns its own big/street/secondary line, so a status message
  // (e.g. "Recalculating route") never gets mistaken for a real maneuver, and
  // there is no default "Continue straight" fallback invented for missing data.
  const navState:'gps-wait'|'preparing'|'recalculating'|'no-route'|'off-route'|'near'|'guiding'=
    !gpsReady?'gps-wait'
    :routing&&!estimate?'preparing'
    :routing&&estimate?'recalculating'
    :estimate?.source!=='google'?'no-route'
    :!onRoad?'off-route'
    :near?'near'
    :'guiding'
  const ManeuverIcon=navState==='near'?Flag:maneuverIconFor(nextManeuver?.type)
  const streetName=canGuide&&nextManeuver?nextManeuver.streetName||splitStreetName(nextManeuver.instruction,locale):null
  const mappedAction=canGuide&&nextManeuver?maneuverActionLabel(nextManeuver.type,locale):null
  const guidingStreetLine=streetName||nextManeuver?.instruction||''
  const guidingActionLine=mappedAction||''
  const instructionDistance=canGuide&&nextManeuver
    ?nextManeuver.distanceToManeuverMeters<15?labels.now:formatDistance(nextManeuver.distanceToManeuverMeters)
    :remainingDistance
  // The next-next maneuver only shows once the current one is close and
  // confirmed by real route data - never a guess at what comes after.
  const afterManeuver=canGuide&&nextManeuver&&nextManeuver.distanceToManeuverMeters<400
    ?estimate?.maneuvers?.[nextManeuver.index+1]
    :undefined
  const AfterIcon=maneuverIconFor(afterManeuver?.type)
  const afterLabel=afterManeuver
    ?(maneuverActionLabel(afterManeuver.type,locale)||afterManeuver.streetName||splitStreetName(afterManeuver.instruction,locale)||afterManeuver.instruction)
    :null
  const arrivalSummary=arrivalTime&&eta!=null
    ?`${locale==='es'?'Llegada':locale==='fr'?'Arrivée':'Arrive'} ${arrivalTime} · ${eta} min`
    :remainingDistance||copy.loading
  const stateCopy=navState==='gps-wait'
    ?{big:labels.gps,street:null,secondary:gpsMessage==='permission'?labels.permission:labels.gpsHint}
    :navState==='preparing'
      ?{big:copy.loading,street:null,secondary:''}
      :navState==='recalculating'
        ?{big:labels.recalculating,street:null,secondary:''}
        :navState==='no-route'
          ?{big:labels.noRoute,street:null,secondary:''}
          :navState==='off-route'
            ?{big:labels.offRoute,street:null,secondary:''}
            :navState==='near'
              ?{big:labels.near,street:null,secondary:arrivalSummary}
              :{big:instructionDistance||labels.now,street:guidingStreetLine,secondary:guidingActionLine}
  const gpsMeta=deviceLocation&&Number.isFinite(deviceLocation.accuracy)
    ?`${locale==='es'?'GPS ±':'GPS ±'}${Math.round(deviceLocation.accuracy)} m · ${Math.max(0,Math.round((Date.now()-deviceLocation.updatedAt)/1000))}${locale==='es'?' s':'s'}`
    :null
  const destinationLabel=validStops[0]?.label||validStops[0]?.address||labels.destination
  const destinationAddress=validStops[0]?.address||''
  const shortAddress=(destinationAddress||destinationLabel).split(',')[0]?.trim()||destinationLabel
  const stopKind=validStops[0]?.kind||'delivery'
  const typeLabel=stopKind==='pickup'?'PICKUP':stopKind==='branch'?'RETURN':'DELIVERY'
  // The original em dash placeholders looked like broken content on a real
  // phone. ETA and distance are only shown after the route service has
  // returned a valid estimate; before that, describe the actual state.
  const metricPendingLabel=navState==='gps-wait'
    ?labels.waitingGps
    :navState==='no-route'
      ?labels.routeUnavailable
      :labels.calculating
  const metricPendingDetail=navState==='gps-wait'
    ?labels.gpsHint
    :navState==='no-route'
      ?labels.noRoute
      :copy.loading
  const upcomingStops=validStops.slice(1,4)
  // No contact-name field reaches this component (PlannedStop only carries
  // address/label/kind/orderNumber/notes) - the expanded panel shows the PO
  // for pickups and any stop notes instead of fabricating a delivery contact.
  const poOrNotes=validStops[0]?.orderNumber
    ?{label:copy.po,value:validStops[0].orderNumber}
    :validStops[0]?.notes
      ?{label:copy.notes,value:validStops[0].notes}
      :null
  const retryGps=()=>{
    setGpsMessage('')
    // Request permission only from an explicit tap. This foreground watch is
    // local to navigation and does not alter Driving Day or persisted GPS.
    if(foregroundGps){setForegroundGps(false);window.setTimeout(()=>setForegroundGps(true),0)}
    else setForegroundGps(true)
  }
  const openMaps=()=>{
    openNavigationWithFallback({address:destinationAddress||destinationLabel,coordinate:destination?{lat:destination.lat,lng:destination.lng}:null,label:destinationLabel})
  }

  return (
    <section className={styles.navigation} data-map-theme={mapTheme} aria-label="Driver Map">
      <aside className={styles.guidance} data-state={navState}>
        <div className={styles.maneuver}><ManeuverIcon size={38}/></div>
        <div className={styles.instruction} aria-live="polite">
          <strong className={styles.bigLine}>{stateCopy.big}</strong>
          {stateCopy.street&&<span className={styles.streetLine}>{stateCopy.street}</span>}
          {stateCopy.secondary&&<span className={styles.actionLine}>{stateCopy.secondary}</span>}
          {gpsMeta&&<span className={styles.gpsMeta}>{gpsMeta}</span>}
        </div>
        <button type="button" aria-label={voiceEnabled?copy.voiceOn:copy.voiceOff} aria-pressed={voiceEnabled} onClick={toggleVoice}>{voiceEnabled?<Volume2 size={20}/>:<VolumeX size={20}/>}</button>
        {afterManeuver&&afterLabel&&(
          <div className={styles.afterChip}>
            <span>{copy.after}</span>
            <AfterIcon size={14}/>
          </div>
        )}
      </aside>
      <div className={styles.mapArea}>
        <GoogleRouteCanvas className={styles.canvas} ariaLabel="Navigation map" path={gpsReady?line:[]} markers={markers} fitPoints={gpsReady?points:destinationOverview} followPosition={displayLocation} followToken={followToken} followDevice={Boolean(navigationOnly||autoStartNavigation)} interactive showTraffic navigation theme={mapTheme} cameraMode={cameraMode} onCameraModeChange={setCameraMode} navigationProgress={currentProgress} navigationHeading={heading} navigationZoom={
          canGuide && nextManeuver
            ? nextManeuver.distanceToManeuverMeters < 90
              ? 18.5
              : nextManeuver.distanceToManeuverMeters < 260
                ? 18
                : 16.8
            : 17.2
        }/>
        {loading&&<div className={styles.notice}>{copy.loading}</div>}
        {!loading&&!gpsReady&&<button className={styles.notice} type="button" onClick={retryGps}><LocateFixed size={18}/>{foregroundGps?labels.gpsAction:labels.enable}</button>}
        {gpsReady&&!routing&&estimate?.source!=='google'&&<button className={styles.notice} type="button" onClick={()=>setRerouteToken(value=>value+1)}>{labels.retry}</button>}
        <div className={styles.controls}>
          <button type="button" aria-label={copy.recenter} aria-pressed={cameraMode==='follow'} onClick={()=>{setCameraMode('follow');setFollowToken(value=>value+1)}}><LocateFixed size={22}/></button>
        </div>
      </div>
      <footer className={styles.bottom} data-expanded={sheetExpanded?'true':'false'}>
        <button
          type="button"
          className={styles.sheetHandleButton}
          aria-expanded={sheetExpanded}
          aria-label={sheetExpanded?copy.collapse:copy.expand}
          onPointerDown={event=>{
            handleDragRef.current={y:event.clientY,engaged:false,moved:false}
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={event=>{
            const drag=handleDragRef.current
            if(!drag)return
            const delta=event.clientY-drag.y
            if(Math.abs(delta)>6)drag.moved=true
            if(!drag.engaged&&delta<-16){drag.engaged=true;onHandleDragStart?.()}
            if(drag.engaged)onHandleDrag?.(delta)
          }}
          onPointerUp={()=>{
            const drag=handleDragRef.current
            handleDragRef.current=null
            if(!drag)return
            if(drag.engaged){onHandleDragEnd?.();return}
            if(!drag.moved)setSheetExpanded(value=>!value)
          }}
          onPointerCancel={()=>{
            const drag=handleDragRef.current
            handleDragRef.current=null
            if(drag?.engaged)onHandleDragEnd?.()
          }}
        >
          <span className={styles.sheetHandle} aria-hidden="true"/>
        </button>
        <div className={styles.stopSummary}>
          <span className={`${styles.typeBadge} ${styles[stopKind]||styles.delivery}`}>{stopKind==='pickup'?<Box size={12}/>:stopKind==='branch'?<Navigation size={12}/>:<PackageCheck size={12}/>} {typeLabel}</span>
          <span className={styles.shortAddress}>{shortAddress}</span>
        </div>
        <div className={styles.primaryRow}>
          <div className={styles.timeBlock}>
            <span className={styles.timeIcon}><Clock size={16}/></span>
            <div className={styles.timeCopy} aria-live="polite">
              <strong className={eta==null?styles.metricPending:undefined}>{eta!=null?`${eta} min`:metricPendingLabel}</strong>
              <span>{eta!=null?([remainingDistance,arrivalTime].filter(Boolean).join(' · ')||labels.approx):metricPendingDetail}</span>
            </div>
          </div>
          <div className={styles.navigationActions}>
            <button type="button" className={styles.exitButton} onClick={()=>{(onExitNavigation||onReturnToday)?.()}}><LogOut size={15}/>{copy.exit}</button>
            <button type="button" className={styles.arrived} disabled={arriving||arrivalDisabled} onClick={()=>void confirmArrival()}><Flag size={16}/>{copy.arrived}</button>
          </div>
        </div>
        <div className={styles.footerRow}>
          <span className={styles.activeDot}><i/>{copy.routeActive}</span>
        </div>
        {sheetExpanded&&(
          <div className={styles.expandedPanel}>
            {destinationAddress&&<div className={styles.expandedRow}><MapPin size={15}/><span>{destinationAddress}</span></div>}
            {poOrNotes&&<div className={styles.expandedRow}><span className={styles.expandedLabel}>{poOrNotes.label}</span><span>{poOrNotes.value}</span></div>}
            {upcomingStops.length>0&&(
              <div className={styles.upcomingBlock}>
                <span className={styles.expandedLabel}>{copy.upcoming} · {`${stopNumber||1}/${stopTotal||Math.max(1,validStops.length)}`}</span>
                <ul>
                  {upcomingStops.map(stop=>(
                    <li key={stop.id}>{stop.kind==='pickup'?<Box size={13}/>:stop.kind==='branch'?<Navigation size={13}/>:<PackageCheck size={13}/>}<span>{stop.label||stop.address}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" className={styles.openMapsButton} onClick={openMaps}><MapPin size={16}/>{copy.openMaps}</button>
          </div>
        )}
      </footer>
    </section>
  )
}
