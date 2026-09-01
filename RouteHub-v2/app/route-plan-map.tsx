'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import {Crosshair,Flag,LocateFixed} from 'lucide-react'
import GoogleRouteCanvas from '../components/google-route-canvas'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute,distanceMeters,nextRouteManeuver} from '../lib/maps/routing'
import {clusterCoordinates,sanitizeCoordinate} from '../lib/maps/coordinates'
import type {RouteEstimate} from '../lib/maps/types'

type Coordinate={lat:number;lng:number}
type GpsFix=Coordinate&{accuracy:number;updatedAt:number;heading:number|null}
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
  sharedLocation?:Coordinate|null
}

export default function RoutePlanMap({
  originAddress,
  originCoordinate=null,
  stops,
  locale='en',
  onReturnToday,
  onExitNavigation,
  onArrive,
  trackDevice=true,
  sharedLocation=null,
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

  const validStops=useMemo(()=>stops.filter(stop=>Boolean(stop.id||stop.address||stop.label||stop.coordinate)),[stops])
  const safeOrigin=sanitizeCoordinate(originCoordinate)
  const routeKey=useMemo(()=>[
    originAddress||'',
    safeOrigin?`${safeOrigin.lat},${safeOrigin.lng}`:'',
    ...validStops.map(stop=>`${stop.id}:${stop.address||''}:${stop.coordinate?.lat||''}:${stop.coordinate?.lng||''}`),
  ].join('|'),[originAddress,safeOrigin,validStops])
  // A rounded key keeps the line useful as the Driver moves without asking
  // Google Routes for a fresh route on every GPS sample.
  const sharedLocationKey=sharedLocation?`${sharedLocation.lat.toFixed(3)},${sharedLocation.lng.toFixed(3)}`:''

  useEffect(()=>{
    let cancelled=false
    setLoading(true)
    setEstimate(null)
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
      if(coordinates.length>1)setLine(coordinates)
      setLoading(false)
      if(coordinates.length<2){setEstimate(null);return}
      const start=sanitizeCoordinate(sharedLocation)||sanitizeCoordinate(deviceLocation)||coordinates[0]
      const rest=coordinates.filter(point=>Math.abs(point.lat-start.lat)>1e-5||Math.abs(point.lng-start.lng)>1e-5)
      const estimate=await calculateRoute([start,...rest])
      if(!cancelled){
        setEstimate(estimate)
        if(estimate.coordinates.length>1)setLine(clusterCoordinates(estimate.coordinates,2_000))
      }
    }).catch(()=>{if(!cancelled){setPoints([]);setLine([]);setEstimate(null);setLoading(false)}})
    return()=>{cancelled=true}
  },[routeKey,sharedLocationKey])

  useEffect(()=>{
    const next=sanitizeCoordinate(sharedLocation)
    if(!next)return
    setDeviceLocation(current=>({
      lat:next.lat,
      lng:next.lng,
      accuracy:current?.accuracy||25,
      updatedAt:Date.now(),
      heading:current?.heading??null,
    }))
  },[sharedLocation?.lat,sharedLocation?.lng])

  useEffect(()=>{
    if(!trackDevice||typeof navigator==='undefined'||!navigator.geolocation)return
    watchRef.current=navigator.geolocation.watchPosition(position=>{
      const next=sanitizeCoordinate({lat:position.coords.latitude,lng:position.coords.longitude})
      if(!next)return
      setDeviceLocation({
        lat:next.lat,
        lng:next.lng,
        accuracy:position.coords.accuracy,
        updatedAt:Date.now(),
        heading:Number.isFinite(position.coords.heading)?position.coords.heading:null,
      })
    },()=>{},{enableHighAccuracy:true,maximumAge:0,timeout:12_000})
    return()=>{
      if(watchRef.current!=null)navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current=null
    }
  },[trackDevice])

  useEffect(()=>()=>{
    if(watchRef.current!=null&&typeof navigator!=='undefined')navigator.geolocation.clearWatch(watchRef.current)
    try{if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel()}catch{}
    void wakeLock.current?.release?.().catch(()=>undefined)
    wakeLock.current=null
  },[])

  const destination=points[1]||points[0]
  const near=Boolean(deviceLocation&&destination&&distanceMeters(deviceLocation,destination)<75)
  const activeLocation=deviceLocation||sanitizeCoordinate(sharedLocation)
  const nextManeuver=useMemo(()=>nextRouteManeuver(estimate?.maneuvers,line,activeLocation||null)||null,[estimate?.maneuvers,line,activeLocation?.lat,activeLocation?.lng])
  const etaSeconds=estimate?.nextStopDurationSeconds
  const eta=Number.isFinite(etaSeconds)?Math.max(1,Math.round(Number(etaSeconds)/60)):null
  const trafficDelay=Boolean(
    Number.isFinite(estimate?.nextStopDurationSeconds) &&
    Number.isFinite(estimate?.staticDurationSeconds) &&
    Number(estimate?.nextStopDurationSeconds)>Number(estimate?.staticDurationSeconds)+60,
  )
  const copy=locale==='es'
    ?{loading:'Preparando el recorrido…',unavailable:'No pudimos ubicar las paradas todavía.',exit:'Salir',arrived:'Llegué',recenter:'Recentrar',eta:'Llegada estimada',traffic:'Tráfico en la ruta',voiceOn:'Voz activa',voiceOff:'Activar voz'}
    :locale==='fr'
      ?{loading:'Préparation du trajet…',unavailable:'Nous ne pouvons pas encore localiser les arrêts.',exit:'Quitter',arrived:'Arrivé',recenter:'Recentrer',eta:'Arrivée estimée',traffic:'Trafic sur l’itinéraire',voiceOn:'Voix active',voiceOff:'Activer la voix'}
      :{loading:'Preparing route…',unavailable:'We could not locate these stops yet.',exit:'Exit',arrived:'Arrived',recenter:'Re-center',eta:'Estimated arrival',traffic:'Traffic on route',voiceOn:'Voice on',voiceOff:'Turn on voice'}
  const markers=useMemo(()=>[
    ...points.map((point,index)=>({
      id:validStops[index]?.id||`stop-${index}`,
      position:point,
      label:String(index+1),
      title:validStops[Math.max(0,index-(safeOrigin||originAddress?1:0))]?.label||validStops[index]?.address||`Stop ${index+1}`,
      tone:index===0?'#1667F2':'#64748B',
    })),
    ...(deviceLocation?[{id:'driver',position:deviceLocation,label:'',title:locale==='es'?'Tu ubicación':locale==='fr'?'Votre position':'Your location',tone:'#0F1D35',driver:true}]:[]),
  ],[points,validStops,safeOrigin,originAddress,deviceLocation,locale])

  const confirmArrival=async()=>{
    if(arriving)return
    setArriving(true)
    try{
      if(onArrive){await onArrive();return}
      onExitNavigation?.()
      onReturnToday?.()
    }finally{
      setArriving(false)
    }
  }

  useEffect(()=>{
    if(!voiceEnabled||!nextManeuver?.instruction||typeof speechSynthesis==='undefined')return
    const instruction=nextManeuver.instruction.trim()
    if(!instruction||lastSpokenInstruction.current===instruction)return
    lastSpokenInstruction.current=instruction
    speechSynthesis.cancel()
    speechSynthesis.speak(new SpeechSynthesisUtterance(instruction))
  },[voiceEnabled,nextManeuver?.instruction])

  return (
    <section className="route-plan-map route-plan-navigate route-plan-driver is-driving" aria-label="Navigation map">
      <div className="route-plan-canvas">
        {loading?<div className="live-route-loading">{copy.loading}</div>:!points.length?<div className="live-route-loading">{copy.unavailable}</div>:<GoogleRouteCanvas className="route-plan-google-canvas" ariaLabel="Navigation map" path={line} markers={markers} fitPoints={points} followPosition={deviceLocation} followToken={followToken} interactive/>}
        {(nextManeuver||eta) && <aside className="route-plan-guidance" aria-live="polite">
          {nextManeuver?.instruction&&<strong>{nextManeuver.instruction}</strong>}
          <span>{eta?`${copy.eta}: ${eta} min`:''}{trafficDelay?` · ${copy.traffic}`:''}</span>
          {nextManeuver?.instruction&&<button type="button" onClick={()=>setVoiceEnabled(current=>!current)}>{voiceEnabled?copy.voiceOn:copy.voiceOff}</button>}
        </aside>}
        {deviceLocation&&<button className="route-plan-recenter" type="button" onClick={()=>setFollowToken(current=>current+1)}><LocateFixed size={20}/><span>{copy.recenter}</span></button>}
        {deviceLocation&&<div className="route-plan-float-controls"><button type="button" aria-label={copy.recenter} onClick={()=>setFollowToken(current=>current+1)}><Crosshair size={23}/></button></div>}
      </div>
      <footer className="route-plan-bottom">
        <div className="route-plan-summary">
          <strong>{validStops[0]?.label||validStops[0]?.address||copy.loading}</strong>
          <span>{validStops.length} {validStops.length===1?'stop':'stops'}</span>
        </div>
        <div className="route-plan-driving-buttons">
          <button type="button" onClick={()=>{onExitNavigation?.();onReturnToday?.()}}>{copy.exit}</button>
          <button type="button" className={`arrived${near?' is-near':''}`} disabled={arriving} onClick={()=>void confirmArrival()}><Flag size={19}/>{copy.arrived}</button>
        </div>
      </footer>
    </section>
  )
}
