/** Compatibility settings for Driver/reference maps that are outside the Manager migration. */
export const mapTileConfig={
  url:process.env.NEXT_PUBLIC_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:'&copy; OpenStreetMap'
} as const

/** Retained only for pure URL helpers; production route calculations use /api/routing and Google Routes. */
export const routingConfig={
  endpoint:(process.env.NEXT_PUBLIC_ROUTING_ENDPOINT||'https://router.project-osrm.org').replace(/\/$/,'')
} as const

/** Server-side geocoding providers used by the controlled beta search routes. */
export const geocodingConfig={
  censusEndpoint:'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress',
  nominatimEndpoint:'https://nominatim.openstreetmap.org/search',
  googleGeocodeEndpoint:'https://maps.googleapis.com/maps/api/geocode/json',
  googleKey:process.env.GOOGLE_MAPS_SERVER_KEY||'',
  userAgent:'RouteHub Beta location search',
  requestTimeoutMs:5000
} as const

export const mapProviderLimits={
  minimumSearchCharacters:3,
  maximumSearchCharacters:180,
  routeTimeoutMs:8000,
  maximumRoutePoints:25,
  routeCacheMs:15*60*1000
} as const

export const floridaBounds={south:24.396308,west:-87.634938,north:31.000888,east:-79.974306} as const

export function isInFlorida(lat:number,lng:number){
  return lat>=floridaBounds.south&&lat<=floridaBounds.north&&lng>=floridaBounds.west&&lng<=floridaBounds.east
}

export function withFloridaQuery(query:string){
  return /(?:^|,\s*)(?:fl|florida)\b/i.test(query)?query:`${query.trim()}, FL, USA`
}
