'use client'

import GoogleRouteCanvas from '../components/google-route-canvas'
import type {MapCoordinate} from '../lib/maps/types'

type Props={
 coordinate:MapCoordinate
 label:string
 onCoordinateChange?:(coordinate:MapCoordinate)=>void
}

/** Confirmation is rendered on the same Google map the route will use. */
export default function LocationConfirmMap({coordinate,label,onCoordinateChange}:Props){
 return <div className="routehub-location-confirm-map" aria-label={`Selected location: ${label}`}>
  <GoogleRouteCanvas
   className="routehub-location-google-map"
   ariaLabel={`Selected location: ${label}`}
   markers={[{id:'selected',position:coordinate,title:label,tone:'#1667F2',draggable:Boolean(onCoordinateChange)}]}
   fitPoints={[coordinate]}
   interactive={Boolean(onCoordinateChange)}
   onMapClick={onCoordinateChange}
   onMarkerDrag={(_,next)=>onCoordinateChange?.(next)}
  />
 </div>
}
