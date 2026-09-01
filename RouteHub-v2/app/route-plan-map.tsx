'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {Crosshair,Flag,LocateFixed} from 'lucide-react'
import {mapTileConfig} from '../lib/maps/map-config'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute,distanceMeters} from '../lib/maps/routing'
import {clusterCoordinates,sanitizeCoordinate} from '../lib/maps/coordinates'

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

function Fit({points}:{points:Coordinate[]}){
  const map=useMap()
  const usable=clusterCoordinates(points)
  const key=usable.map(point=>`${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join('|')
  useEffect(()=>{
    if(!usable.length)return
    if(usable.length>1)map.fitBounds(usable.map(point=>[point.lat,point.lng] as [number,number]),{padding:[28,28],maxZoom:14})
    else map.setView([usable[0].lat,usable[0].lng],13)
  },[map,key])
  return null
}

const stopIcon=(number:number)=>L.divIcon({
  className:'route-plan-marker-wrap',
  html:`<span class="route-plan-marker${number===1?' is-active':''}">${number}</span>`,
  iconSize:[36,36],iconAnchor:[18,18],
})

const driverIcon=()=>L.divIcon({
  className:'route-plan-driver-location',
  html:'<span class="route-plan-driver-arrow"><i></i></span>',
  iconSize:[48,48],iconAnchor:[24,24],
})

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
  const [deviceLocation,setDeviceLocation]=useState<GpsFix|null>(null)
  const [map,setMap]=useState<L.Map|null>(null)
  const [loading,setLoading]=useState(true)
  const [arriving,setArriving]=useState(false)
  const watchRef=useRef<number|null>(null)
  const wakeLock=useRef<{release?:()=>Promise<void>}|null>(null)

  const validStops=useMemo(()=>stops.filter(stop=>Boolean(stop.id||stop.address||stop.label||stop.coordinate)),[stops])
  const safeOrigin=sanitizeCoordinate(originCoordinate)
  const routeKey=useMemo(()=>[
    originAddress||'',
    safeOrigin?`${safeOrigin.lat},${safeOrigin.lng}`:'',
    ...validStops.map(stop=>`${stop.id}:${stop.address||''}:${stop.coordinate?.lat||''}:${stop.coordinate?.lng||''}`),
  ].join('|'),[originAddress,safeOrigin,validStops])

  useEffect(()=>{
    let cancelled=false
    setLoading(true)
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
      if(coordinates.length<2)return
      const start=sanitizeCoordinate(deviceLocation)||sanitizeCoordinate(sharedLocation)||coordinates[0]
      const rest=coordinates.filter(point=>Math.abs(point.lat-start.lat)>1e-5||Math.abs(point.lng-start.lng)>1e-5)
      const estimate=await calculateRoute([start,...rest])
      if(!cancelled&&estimate.coordinates.length>1)setLine(clusterCoordinates(estimate.coordinates,2_000))
    }).catch(()=>{if(!cancelled){setPoints([]);setLine([]);setLoading(false)}})
    return()=>{cancelled=true}
  },[routeKey])

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
  const copy=locale==='es'
    ?{loading:'Preparando el recorrido…',unavailable:'No pudimos ubicar las paradas todavía.',exit:'Salir',arrived:'Llegué',recenter:'Recentrar'}
    :locale==='fr'
      ?{loading:'Préparation du trajet…',unavailable:'Nous ne pouvons pas encore localiser les arrêts.',exit:'Quitter',arrived:'Arrivé',recenter:'Recentrer'}
      :{loading:'Preparing route…',unavailable:'We could not locate these stops yet.',exit:'Exit',arrived:'Arrived',recenter:'Re-center'}
  const center=points[0]||sanitizeCoordinate(sharedLocation)||{lat:25.7617,lng:-80.1918}

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

  return (
    <section className="route-plan-map route-plan-navigate route-plan-driver is-driving" aria-label="Navigation map">
      <div className="route-plan-canvas">
        {loading?<div className="live-route-loading">{copy.loading}</div>:!points.length?<div className="live-route-loading">{copy.unavailable}</div>:(
          <MapContainer ref={setMap} center={[center.lat,center.lng]} zoom={13} scrollWheelZoom={false}>
            <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
            <Fit points={points}/>
            {line.length>1&&<Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#176bf2',weight:6,opacity:.96}}/>}
            {points.map((point,index)=>(
              <Marker key={validStops[index]?.id||index} position={[point.lat,point.lng]} icon={stopIcon(index+1)}>
                <Tooltip direction="top">{validStops[Math.max(0,index-(safeOrigin||originAddress?1:0))]?.label||validStops[index]?.address||`Stop ${index+1}`}</Tooltip>
              </Marker>
            ))}
            {deviceLocation&&<Marker position={[deviceLocation.lat,deviceLocation.lng]} icon={driverIcon()}><Tooltip direction="top">{locale==='es'?'Tu ubicación':locale==='fr'?'Votre position':'Your location'}</Tooltip></Marker>}
          </MapContainer>
        )}
        {deviceLocation&&<button className="route-plan-recenter" type="button" onClick={()=>map?.setView([deviceLocation.lat,deviceLocation.lng],16)}><LocateFixed size={20}/><span>{copy.recenter}</span></button>}
        {deviceLocation&&<div className="route-plan-float-controls"><button type="button" aria-label={copy.recenter} onClick={()=>map?.setView([deviceLocation.lat,deviceLocation.lng],17)}><Crosshair size={23}/></button></div>}
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
