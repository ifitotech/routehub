'use client'

import {MapPin} from 'lucide-react'
import {sanitizeCoordinate} from '../lib/maps/coordinates'
import type {MapCoordinate} from '../lib/maps/types'

type Props={
  destination:MapCoordinate|null
  driverLocation?:MapCoordinate|null
  label:string
}

function embedUrl(destination:MapCoordinate,driverLocation:MapCoordinate|null){
  const driver=sanitizeCoordinate(driverLocation)
  const latitude=driver?[destination.lat,driver.lat]:[destination.lat]
  const longitude=driver?[destination.lng,driver.lng]:[destination.lng]
  const padLat=Math.max(.008,(Math.max(...latitude)-Math.min(...latitude))*.28)
  const padLng=Math.max(.012,(Math.max(...longitude)-Math.min(...longitude))*.28)
  const left=Math.min(...longitude)-padLng
  const bottom=Math.min(...latitude)-padLat
  const right=Math.max(...longitude)+padLng
  const top=Math.max(...latitude)+padLat
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${left},${bottom},${right},${top}`)}&layer=mapnik&marker=${encodeURIComponent(`${destination.lat},${destination.lng}`)}`
}

/** Lightweight Today preview: it deliberately avoids the Google Maps quota. */
export default function OpenStreetRoutePreview({destination,driverLocation=null,label}:Props){
  const safeDestination=sanitizeCoordinate(destination)
  if(!safeDestination)return <div className="openstreet-route-empty"><MapPin size={20}/><span>{label}</span></div>
  return <iframe className="openstreet-route-preview" title={label} src={embedUrl(safeDestination,driverLocation)} loading="lazy" referrerPolicy="no-referrer" tabIndex={-1}/>
}
