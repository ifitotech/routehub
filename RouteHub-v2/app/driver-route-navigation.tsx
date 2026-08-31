'use client'

import RoutePlanMap from './route-plan-map'

type Props = {
  originAddress?: string | null
  destinationAddress?: string | null
  destinationCoordinate?: {lat: number; lng: number} | null
  locale?: string
  [key: string]: unknown
}

/** Full-screen Driver navigation adapter. The operational Driver page keeps
 * its existing route state while this component supplies the richer internal
 * navigation experience (GPS, maneuvers, rerouting and voice). */
export default function DriverRouteNavigation({originAddress,destinationAddress,locale}: Props) {
  return <RoutePlanMap
    navigationOnly
    autoStartNavigation
    originAddress={originAddress}
    locale={locale}
    stops={[{id:'current-stop',address:destinationAddress,label:destinationAddress}]}
  />
}
