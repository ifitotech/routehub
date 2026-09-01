'use client'

import {useEffect,useMemo,useState} from 'react'
import {MapPin,Route,Truck} from 'lucide-react'
import GoogleRouteCanvas from '../components/google-route-canvas'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute,nextRouteManeuver} from '../lib/maps/routing'
import {clusterCoordinates,sanitizeCoordinate} from '../lib/maps/coordinates'
import type {ActiveRouteManeuver,RouteManeuver} from '../lib/maps/types'

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
 onManeuver?:(maneuver:ActiveRouteManeuver|null)=>void
}

async function resolveCoordinate(address:string|null|undefined,known:RouteCoordinate|null|undefined){
 if(known)return sanitizeCoordinate(known)
 if(!address)return null
 try{return sanitizeCoordinate((await geocodeAddress(address))?.coordinate||null)}catch{return null}
}

/** Google Maps renderer for the same RouteHub Core route coordinates. */
export default function LiveRouteMap({originAddress,destinationAddress,originCoordinate,destinationCoordinate,waypoints=[],driverLocation,driverUpdatedAt,title='Live route',showHeader=true,showLocationUpdated=true,interactive=true,onActivate,useDriverAsOrigin=false,locale='en',followToken=0,onManeuver}:Props & {followToken?:number}){
 const [routePoints,setRoutePoints]=useState<RouteCoordinate[]>([])
 const [line,setLine]=useState<RouteCoordinate[]>([])
 const [maneuvers,setManeuvers]=useState<RouteManeuver[]>([])
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
   const points=clusterCoordinates(coordinates)
   if(cancelled)return
   setRoutePoints(points)
   setLine(points)
   setManeuvers([])
   setUnavailable(!points.length)
   if(points.length>1){
    const estimate=await calculateRoute(points)
    if(!cancelled&&estimate.coordinates.length>1){
     setLine(clusterCoordinates(estimate.coordinates,2_000))
     setManeuvers(estimate.maneuvers||[])
    }
   }
   if(!cancelled)setLoading(false)
  }).catch(()=>{if(!cancelled){setUnavailable(true);setLoading(false)}})
  return()=>{cancelled=true}
 },[originAddress,originCoordinate?.lat,originCoordinate?.lng,destinationAddress,destinationCoordinate?.lat,destinationCoordinate?.lng,waypointKey,useDriverAsOrigin,useDriverAsOrigin?driverLocation?.lat:null,useDriverAsOrigin?driverLocation?.lng:null])

 useEffect(()=>{
  if(!onManeuver)return
  onManeuver(nextRouteManeuver(maneuvers,line,driverLocation||null)||null)
 },[maneuvers,line,driverLocation?.lat,driverLocation?.lng,onManeuver])

 const copy=locale==='es'
  ?{connected:'Conductor conectado',scheduled:'Ruta programada',live:'EN VIVO',waiting:'EN ESPERA',loading:'Preparando mapa…',unavailable:'No pudimos ubicar esta ruta todavía.',map:'Mapa de ruta en vivo',driver:'Conductor',start:'Inicio',next:'Próxima parada',updated:'Ubicación actualizada'}
  :locale==='fr'
   ?{connected:'Conducteur connecté',scheduled:'Itinéraire programmé',live:'EN DIRECT',waiting:'EN ATTENTE',loading:'Préparation de la carte…',unavailable:'Nous ne pouvons pas encore localiser cet itinéraire.',map:'Carte de l’itinéraire',driver:'Conducteur',start:'Départ',next:'Prochain arrêt',updated:'Position actualisée'}
   :{connected:'Driver connected',scheduled:'Route scheduled',live:'LIVE',waiting:'WAITING',loading:'Preparing map…',unavailable:'We could not locate this route yet.',map:'Live route map',driver:'Driver',start:'Start',next:'Next stop',updated:'Location updated'}
 const origin=routePoints[0]||null
 const routeStops=routePoints.slice(1)
 const markers=useMemo(()=>[
  ...(origin&&(!useDriverAsOrigin||!driverLocation)?[{id:'origin',position:origin,label:'S',title:copy.start,tone:'#0F1D35'}]:[]),
  ...routeStops.map((point,index)=>{
   const last=index===routeStops.length-1
   return {id:`stop-${index}`,position:point,label:String(index+1),title:last?(destinationAddress||`${copy.next} ${index+1}`):(waypoints[index]?.label||`${copy.next} ${index+1}`),tone:last?'#1667F2':'#7C3AED'}
  }),
  ...(driverLocation?[{id:'driver',position:driverLocation,label:'',title:copy.driver,tone:'#0F1D35',driver:true}]:[]),
 ],[origin,routeStops,useDriverAsOrigin,driverLocation,copy.start,copy.next,copy.driver,destinationAddress,waypoints])

 return <section className={`live-route-map ${onActivate?'is-activatable':''}`} onClick={onActivate} onKeyDown={event=>{if(onActivate&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onActivate()}}} role={onActivate?'button':undefined} tabIndex={onActivate?0:undefined}>
  {showHeader&&<header className="live-route-map-head"><div><span><Route size={15}/> {title}</span><strong>{driverLocation?copy.connected:copy.scheduled}</strong></div><span className={`live-route-state ${driverLocation?'is-live':''}`}><i/>{driverLocation?copy.live:copy.waiting}</span></header>}
  <div className="live-route-canvas">
   {loading?<div className="live-route-loading">{copy.loading}</div>:unavailable?<div className="live-route-loading"><MapPin size={19}/><span>{copy.unavailable}</span></div>:<GoogleRouteCanvas className="live-route-google-canvas" ariaLabel={copy.map} path={line} markers={markers} fitPoints={routePoints} followPosition={useDriverAsOrigin?driverLocation:null} followToken={followToken||0} interactive={interactive}/>}
  </div>
  <footer><span><b>S</b>{useDriverAsOrigin&&driverLocation?(locale==='es'?'Mi ubicación':locale==='fr'?'Ma position':'My location'):(originAddress||copy.start)}</span><span><b>1</b>{destinationAddress||copy.next}</span>{showLocationUpdated&&driverUpdatedAt&&<small><Truck size={13}/>{copy.updated}</small>}</footer>
 </section>
}
