'use client'

import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {ArrowUp,CornerUpLeft,CornerUpRight,Flag,LocateFixed,Route,RotateCcw,Volume2,VolumeX} from 'lucide-react'
import GoogleRouteCanvas from '../components/google-route-canvas'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute,distanceMeters} from '../lib/maps/routing'
import {clusterCoordinates,sanitizeCoordinate} from '../lib/maps/coordinates'
import type {RouteEstimate} from '../lib/maps/types'
import {distanceFromNavigationPath,usableNavigationFix,projectNavigationPosition,navigationManeuver,navigationRemainingSeconds,type NavigationProgress} from '../lib/maps/navigation-progress'
import styles from './driver-navigation.module.css'

type Coordinate={lat:number;lng:number}
type GpsFix=Coordinate&{accuracy:number;updatedAt:number;heading:number|null}
type SharedGpsFix=Coordinate&{accuracy?:number;heading?:number|null;at?:string}
export type PlannedStop={id:string;address?:string|null;label?:string|null;kind?:'pickup'|'delivery'|'branch';orderNumber?:string|null;notes?:string|null;position?:number;pastDue?:boolean;pending?:boolean;coordinate?:Coordinate|null}

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
}:Props){
  const [points,setPoints]=useState<Coordinate[]>([])
  const [line,setLine]=useState<Coordinate[]>([])
  const [estimate,setEstimate]=useState<RouteEstimate|null>(null)
  const [deviceLocation,setDeviceLocation]=useState<GpsFix|null>(null)
  const [loading,setLoading]=useState(true)
  const [arriving,setArriving]=useState(false)
  const [voiceEnabled,setVoiceEnabled]=useState(false)
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
      const start=(usableNavigationFix(deviceLocation,Date.now())?sanitizeCoordinate(deviceLocation):null)||sanitizeCoordinate(resolved[0])
      const rest=resolved.slice(1)
      // Do not silently skip an unresolved current destination and route to a
      // later stop. The assigned order remains authoritative.
      if(rest.some(point=>!point)){setEstimate(null);setLine([]);setRouting(false);return}
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
    }).catch(()=>{if(!cancelled){setPoints([]);setLine([]);setEstimate(null);setLoading(false);setRouting(false)}})
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
  const copy=locale==='es'
    ?{loading:'Preparando el recorrido…',unavailable:'No pudimos ubicar las paradas todavía.',exit:'Salir',arrived:'Llegué',recenter:'Recentrar',eta:'Llegada estimada',traffic:'Tráfico',voiceOn:'Silenciar voz',voiceOff:'Activar voz'}
    :locale==='fr'
      ?{loading:'Préparation du trajet…',unavailable:'Nous ne pouvons pas encore localiser les arrêts.',exit:'Quitter',arrived:'Arrivé',recenter:'Recentrer',eta:'Arrivée estimée',traffic:'Trafic sur l’itinéraire',voiceOn:'Voix active',voiceOff:'Activer la voix'}
      :{loading:'Preparing route…',unavailable:'We could not locate these stops yet.',exit:'Exit',arrived:'Arrived',recenter:'Re-center',eta:'Estimated arrival',traffic:'Traffic on route',voiceOn:'Voice on',voiceOff:'Turn on voice'}
  const displayLocation=matched&&currentProgress?currentProgress.coordinate:deviceLocation
  const heading=matched&&currentProgress?currentProgress.heading:deviceLocation?.heading??null
  const markers=useMemo(()=>[
    ...destinations.map((point,index)=>({
      id:validStops[index]?.id||`stop-${index}`,
      position:point,
      label:String(index+1),
      title:validStops[index]?.label||validStops[index]?.address||`Stop ${index+1}`,
      tone:'#0F1D35',
    })),
    ...(displayLocation?[{id:'driver',position:displayLocation,label:'',title:locale==='es'?'Tu ubicación':locale==='fr'?'Votre position':'Your location',tone:'#1667F2',driver:true,heading}]:[]),
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
    gps:'Buscando GPS preciso',permission:'Permite la ubicación precisa en los ajustes del navegador.',gpsHint:'La guía se pausó hasta recuperar una ubicación fiable.',enable:'Activar GPS',retry:'Reintentar',route:'Vista completa',follow:'Seguir',approx:'ETA aproximado',offRoute:'Comprobando el recorrido',noRoute:'Recorrido por calles no disponible',near:'Cerca del destino',destination:'Destino',now:'Ahora',distance:'Restante',arrival:'Llegada',paused:'Guía pausada',gpsAction:'Reintentar GPS',
  }:locale==='fr'?{
    gps:'Recherche GPS précis',permission:'Autorisez la position précise dans les réglages du navigateur.',gpsHint:'Guidage en pause jusqu’au retour d’une position fiable.',enable:'Activer GPS',retry:'Réessayer',route:'Vue du trajet',follow:'Suivre',approx:'ETA approximatif',offRoute:'Vérification du trajet',noRoute:'Trajet routier indisponible',near:'Destination proche',destination:'Destination',now:'Maintenant',distance:'Restant',arrival:'Arrivée',paused:'Guidage en pause',gpsAction:'Réessayer GPS',
  }:{
    gps:'Acquiring accurate GPS',permission:'Allow precise location in your browser settings.',gpsHint:'Guidance is paused until a reliable location returns.',enable:'Enable GPS',retry:'Retry',route:'Route overview',follow:'Follow',approx:'Approximate ETA',offRoute:'Checking route',noRoute:'Street route unavailable',near:'Near destination',destination:'Destination',now:'Now',distance:'Remaining',arrival:'Arrival',paused:'Guidance paused',gpsAction:'Retry GPS',
  }
  const ManeuverIcon=near&&guidanceReady?Flag:nextManeuver?.type?.includes('UTURN')?RotateCcw:nextManeuver?.type?.includes('LEFT')?CornerUpLeft:nextManeuver?.type?.includes('RIGHT')?CornerUpRight:ArrowUp
  const canGuide=guidanceReady&&!routing
  const instruction=!gpsReady?labels.gps:routing?copy.loading:estimate?.source!=='google'?labels.noRoute:!onRoad?labels.offRoute:near?labels.near:nextManeuver?.instruction||labels.destination
  const retryGps=()=>{
    setGpsMessage('')
    // Request permission only from an explicit tap. This foreground watch is
    // local to navigation and does not alter Driving Day or persisted GPS.
    if(foregroundGps){setForegroundGps(false);window.setTimeout(()=>setForegroundGps(true),0)}
    else setForegroundGps(true)
  }

  return (
    <section className={styles.navigation} aria-label="Driver Map">
      <aside className={styles.guidance} aria-live="polite">
        <div className={styles.maneuver}><ManeuverIcon size={30}/><b>{canGuide&&nextManeuver?(nextManeuver.distanceToManeuverMeters<15?labels.now:formatDistance(nextManeuver.distanceToManeuverMeters)):'GPS'}</b></div>
        <div className={styles.instruction}><strong>{instruction}</strong><span>{!gpsReady?(gpsMessage==='permission'?labels.permission:labels.gpsHint):validStops[0]?.label||validStops[0]?.address}</span></div>
        <button type="button" aria-label={voiceEnabled?copy.voiceOn:copy.voiceOff} aria-pressed={voiceEnabled} onClick={()=>setVoiceEnabled(current=>!current)}>{voiceEnabled?<Volume2 size={22}/>:<VolumeX size={22}/>}</button>
      </aside>
      <div className={styles.mapArea}>
        <GoogleRouteCanvas className={styles.canvas} ariaLabel="Navigation map" path={line} markers={markers} fitPoints={points} followPosition={displayLocation} followToken={followToken} followDevice={Boolean(navigationOnly||autoStartNavigation)} interactive showTraffic navigation cameraMode={cameraMode} onCameraModeChange={setCameraMode} navigationProgress={currentProgress} navigationHeading={heading} navigationZoom={canGuide&&nextManeuver&&nextManeuver.distanceToManeuverMeters<150?18:17.5}/>
        {loading&&<div className={styles.notice}>{copy.loading}</div>}
        {!loading&&!gpsReady&&<button className={styles.notice} type="button" onClick={retryGps}><LocateFixed size={18}/>{foregroundGps?labels.gpsAction:labels.enable}</button>}
        {gpsReady&&!routing&&estimate?.source!=='google'&&<button className={styles.notice} type="button" onClick={()=>setRerouteToken(value=>value+1)}>{labels.retry}</button>}
        <div className={styles.controls}>
          <button type="button" aria-label={labels.route} aria-pressed={cameraMode==='overview'} onClick={()=>setCameraMode('overview')}><Route size={22}/></button>
          <button type="button" aria-label={copy.recenter} aria-pressed={cameraMode==='follow'} onClick={()=>{setCameraMode('follow');setFollowToken(value=>value+1)}}><LocateFixed size={22}/>{cameraMode!=='follow'&&<span>{labels.follow}</span>}</button>
        </div>
      </div>
      <footer className={styles.bottom}>
        <div className={styles.metrics} aria-label={labels.approx}>
          <div><strong>{eta!=null?`${eta} min`:'—'}</strong><small>{guidanceReady?labels.approx:labels.paused}</small></div>
          <div><b>{guidanceReady?formatDistance(currentProgress?.remainingMeters):'—'}</b><small>{labels.distance}</small></div>
          <div><b>{arrivalTime||'—'}</b><small>{labels.arrival}</small></div>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={()=>{(onExitNavigation||onReturnToday)?.()}}>{copy.exit}</button>
          <button type="button" className={styles.arrived} disabled={arriving||arrivalDisabled} onClick={()=>void confirmArrival()}><Flag size={19}/>{copy.arrived}</button>
        </div>
      </footer>
    </section>
  )
}
