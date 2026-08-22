'use client'

import {useEffect,useMemo,useState} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'

type Coordinate={lat:number;lng:number}
export type PlannedStop={id:string;address?:string|null;label?:string|null}

type Props={originAddress?:string|null;stops:PlannedStop[]}

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

async function geocode(address?:string|null){
 if(!address)return null
 const response=await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
 if(!response.ok)return null
 const data=await response.json() as {coordinate?:Coordinate|null}
 return data.coordinate||null
}

export default function RoutePlanMap({originAddress,stops}:Props){
 const [points,setPoints]=useState<Coordinate[]>([])
 const [line,setLine]=useState<Coordinate[]>([])
 const [loading,setLoading]=useState(true)
 const validStops=useMemo(()=>stops.filter(stop=>Boolean(stop.address)),[stops])
 const addresses=useMemo(()=>[originAddress,...validStops.map(stop=>stop.address)].filter(Boolean) as string[],[originAddress,validStops])

 useEffect(()=>{
  let cancelled=false
  setLoading(true)
  Promise.all(addresses.map(address=>geocode(address))).then(next=>{
   if(cancelled)return
   const coordinates=next.filter(Boolean) as Coordinate[]
   setPoints(coordinates)
   setLine(coordinates)
   setLoading(false)
   if(coordinates.length<2)return
   const path=coordinates.map(point=>`${point.lng},${point.lat}`).join(';')
   return fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`)
    .then(response=>response.ok?response.json():null)
    .then((data:{routes?:Array<{geometry?:{coordinates?:[number,number][]}}>}|null)=>{
     const coordinates=data?.routes?.[0]?.geometry?.coordinates?.map(([lng,lat])=>({lat,lng}))||[]
     if(!cancelled&&coordinates.length)setLine(coordinates)
    })
  }).catch(()=>{if(!cancelled){setPoints([]);setLine([]);setLoading(false)}})
  return()=>{cancelled=true}
 },[addresses])

 const center=points[0]||{lat:39.8283,lng:-98.5795}
 return <section className="route-plan-map" aria-label="Mapa de todas las paradas">
  <div className="route-plan-canvas">{loading?<div className="live-route-loading">Preparando el recorrido…</div>:!points.length?<div className="live-route-loading">No pudimos ubicar las paradas todavía.</div>:<MapContainer center={[center.lat,center.lng]} zoom={11} scrollWheelZoom={false} aria-label="Recorrido completo">
   <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
   <Fit points={points}/>
   {line.length>1&&<Polyline positions={line.map(point=>[point.lat,point.lng] as [number,number])} pathOptions={{color:'#1763de',weight:5,opacity:.9}}/>}
   {points.slice(1).map((point,index)=><Marker key={validStops[index]?.id||index} position={[point.lat,point.lng]} icon={marker(index+1)}><Tooltip direction="top" offset={[0,-18]}>{validStops[index]?.label||`Parada ${index+1}`}</Tooltip></Marker>)}
  </MapContainer>}</div>
  <footer><span>{validStops.length} {validStops.length===1?'parada programada':'paradas programadas'}</span><small>Vista completa de la ruta</small></footer>
 </section>
}
