export type MapCoordinate={lat:number;lng:number}

export type GeocodedLocation={
  name?:string
  formattedAddress:string
  coordinate:MapCoordinate
  source:'routehub'|'census'|'nominatim'|'manual'
  externalId?:string
}

export type RouteEstimate={
  coordinates:MapCoordinate[]
  distanceMeters?:number
  durationSeconds?:number
  source:'osrm'|'fallback'
  maneuvers?:RouteManeuver[]
}

export type RouteManeuver={instruction:string;distanceMeters?:number;coordinate:MapCoordinate}

export type NavigationDestination={
  address?:string|null
  coordinate?:MapCoordinate|null
  label?:string|null
}
