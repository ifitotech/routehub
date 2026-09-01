export type MapCoordinate={lat:number;lng:number}

export type GeocodedLocation={
  name?:string
  formattedAddress:string
  coordinate:MapCoordinate
  source:'routehub'|'census'|'nominatim'|'google'|'manual'
  externalId?:string
}

export type RouteEstimate={
  coordinates:MapCoordinate[]
  distanceMeters?:number
  durationSeconds?:number
  /** Historical, traffic-unaware duration returned by Google Routes. */
  staticDurationSeconds?:number
  /** First active leg: the current Driver stop, not an invented route-wide ETA. */
  nextStopDistanceMeters?:number
  nextStopDurationSeconds?:number
  nextStopStaticDurationSeconds?:number
  source:'google'|'fallback'
  maneuvers?:RouteManeuver[]
}

export type RouteManeuver={
  instruction:string
  distanceMeters?:number
  coordinate:MapCoordinate
  type?:string
  modifier?:string
  streetName?:string
}

export type ActiveRouteManeuver=RouteManeuver&{
  distanceToManeuverMeters:number
}

export type NavigationDestination={
  address?:string|null
  coordinate?:MapCoordinate|null
  label?:string|null
}
