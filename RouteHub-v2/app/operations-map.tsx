'use client'

import {Fragment, useEffect, useMemo, useState} from 'react'
import L from 'leaflet'
import {MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap} from 'react-leaflet'
import {Truck} from 'lucide-react'
import styles from './operations-map.module.css'

type Coordinate = {lat:number;lng:number}

export type OperationsRoute = {
  id:string
  origin_address?:string|null
  destination_address?:string|null
  destination_name?:string|null
  status?:string|null
  driver_id?:string|null
  position?:number|null
}

export type OperationsDriverLocation = {
  id:string
  driver_id:string
  location:Coordinate
  label?:string
}

type ResolvedRoute = OperationsRoute & {points:Coordinate[];line:Coordinate[];number:number}
type Props = {routes:OperationsRoute[];driverLocations?:OperationsDriverLocation[];locale?:string;interactive?:boolean}

const fallbackCenter:Coordinate = {lat:39.8283,lng:-98.5795}

function routeColor(status?:string|null){
  if(status==='issue')return '#dc2626'
  if(status==='active'||status==='paused')return '#16a34a'
  return '#eab308'
}

function statusLabel(status:string|undefined|null,locale:string){
  if(locale==='es')return status==='issue'?'Incidencia':status==='active'||status==='paused'?'Ruta actual':'Pendiente'
  if(locale==='fr')return status==='issue'?'Incident':status==='active'||status==='paused'?'Itinéraire actuel':'En attente'
  return status==='issue'?'Issue':status==='active'||status==='paused'?'Current route':'Pending'
}

function routeMarker(number:number,color:string){
  return L.divIcon({className:'operations-route-marker-wrap',html:`<span class="operations-route-marker" style="--marker-color:${color}">${number}</span>`,iconSize:[34,34],iconAnchor:[17,17]})
}

function originMarker(color:string){
  return L.divIcon({className:'operations-origin-marker-wrap',html:`<span class="operations-origin-marker" style="--marker-color:${color}"></span>`,iconSize:[14,14],iconAnchor:[7,7]})
}

function driverMarker(){
  return L.divIcon({className:'operations-driver-marker-wrap',html:'<span class="operations-driver-marker">🚚</span>',iconSize:[42,42],iconAnchor:[21,21]})
}

function FitBounds({points}:{points:Coordinate[]}){
  const map = useMap()
  const key = points.map(point => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|')
  useEffect(() => {
    if(!points.length)return
    if(points.length===1){map.setView([points[0].lat,points[0].lng],13);return}
    map.fitBounds(points.map(point => [point.lat,point.lng] as [number,number]),{padding:[28,28],maxZoom:14})
  },[key,map,points])
  return null
}

async function geocode(address:string,signal:AbortSignal){
  const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`,{signal})
  if(!response.ok)return null
  const payload = await response.json() as {coordinate?:Coordinate|null}
  return payload.coordinate || null
}

async function routeLine(points:Coordinate[],signal:AbortSignal){
  if(points.length<2)return points
  const path = points.map(point => `${point.lng},${point.lat}`).join(';')
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`,{signal})
  if(!response.ok)return points
  const payload = await response.json() as {routes?:Array<{geometry?:{coordinates?:[number,number][]}}>}
  return payload.routes?.[0]?.geometry?.coordinates?.map(([lng,lat]) => ({lat,lng})) || points
}

export default function OperationsMap({routes,driverLocations=[],locale='en',interactive=true}:Props){
  const [resolved,setResolved] = useState<ResolvedRoute[]>([])
  const [loading,setLoading] = useState(true)
  const visibleRoutes = useMemo(() => routes.filter(route => route.origin_address || route.destination_address),[routes])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.all(visibleRoutes.map(async(route,index) => {
      const addresses = [route.origin_address,route.destination_address].filter(Boolean) as string[]
      const geocoded = await Promise.all(addresses.map(address => geocode(address,controller.signal).catch(() => null)))
      const points = geocoded.filter(Boolean) as Coordinate[]
      const line = await routeLine(points,controller.signal).catch(() => points)
      return {...route,points,line,number:index+1}
    })).then(next => {
      if(!controller.signal.aborted)setResolved(next)
    }).catch(() => {
      if(!controller.signal.aborted)setResolved([])
    }).finally(() => {
      if(!controller.signal.aborted)setLoading(false)
    })
    return () => controller.abort()
  },[visibleRoutes])

  const allPoints = useMemo(() => [...resolved.flatMap(route => route.points),...driverLocations.map(driver => driver.location)],[driverLocations,resolved])
  const center = allPoints[0] || fallbackCenter
  const copy = locale==='es'
    ? {label:'Mapa operativo de rutas',loading:'Preparando mapa operativo…',unavailable:'No pudimos ubicar las rutas todavía.',current:'Ruta actual',pending:'Pendientes',issue:'Incidencias',driver:'Conductor'}
    : locale==='fr'
      ? {label:'Carte opérationnelle des itinéraires',loading:'Préparation de la carte opérationnelle…',unavailable:'Nous ne pouvons pas encore localiser les itinéraires.',current:'Itinéraire actuel',pending:'En attente',issue:'Incidents',driver:'Conducteur'}
      : {label:'Route operations map',loading:'Preparing operations map…',unavailable:'We could not locate these routes yet.',current:'Current route',pending:'Pending',issue:'Issues',driver:'Driver'}

  return <section className={styles.map} aria-label={copy.label}>
    <div className={styles.canvas}>
      {loading ? <div className={styles.state}>{copy.loading}</div> : !resolved.length && !driverLocations.length ? <div className={styles.state}>{copy.unavailable}</div> : <MapContainer center={[center.lat,center.lng]} zoom={11} scrollWheelZoom={false} dragging={interactive} touchZoom={interactive} doubleClickZoom={interactive} zoomControl={interactive}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        <FitBounds points={allPoints}/>
        {resolved.map(route => <Fragment key={`route-${route.id}`}>
          {route.line.length>1&&<Polyline positions={route.line.map(point => [point.lat,point.lng] as [number,number])} pathOptions={{color:routeColor(route.status),weight:5,opacity:.9}}/>}
          {route.points[0]&&<Marker position={[route.points[0].lat,route.points[0].lng]} icon={originMarker(routeColor(route.status))}/>} 
          {route.points[route.points.length-1]&&<Marker position={[route.points[route.points.length-1].lat,route.points[route.points.length-1].lng]} icon={routeMarker(route.number,routeColor(route.status))} zIndexOffset={200}>
            <Tooltip direction="top" offset={[0,-16]}>{`${statusLabel(route.status,locale)} · ${route.destination_name || route.destination_address || copy.driver}`}</Tooltip>
          </Marker>}
        </Fragment>)}
        {driverLocations.map(driver => <Marker key={driver.id} position={[driver.location.lat,driver.location.lng]} icon={driverMarker()} zIndexOffset={1000}>
          <Tooltip direction="top" offset={[0,-20]} permanent>{driver.label || copy.driver}</Tooltip>
        </Marker>)}
      </MapContainer>}
      <div className={styles.legend} aria-label={copy.label}>
        <span><i className={styles.current}/>{copy.current}</span><span><i className={styles.pending}/>{copy.pending}</span><span><i className={styles.issue}/>{copy.issue}</span><span><Truck size={13}/>{driverLocations.length} {copy.driver.toLowerCase()}{driverLocations.length===1?'':'s'}</span>
      </div>
    </div>
    <footer><span>{routes.length} {locale==='es'?'rutas configuradas':locale==='fr'?'itinéraires configurés':'configured routes'}</span><small>{driverLocations.length ? `${driverLocations.length} ${copy.driver.toLowerCase()}${driverLocations.length===1?'':'s'} · ${locale==='es'?'ubicación actualizada':locale==='fr'?'position actualisée':'location updated'}` : (locale==='es'?'Sin ubicación activa':locale==='fr'?'Aucune position active':'No active location')}</small></footer>
  </section>
}
