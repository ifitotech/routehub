/** Google is first for maps, route calculation and address lookup. Open providers are geocoding fallback only. */
export const geocodingConfig={
  censusEndpoint:'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress',
  nominatimEndpoint:'https://nominatim.openstreetmap.org/search',
  googleGeocodeEndpoint:'https://maps.googleapis.com/maps/api/geocode/json',
  googleKey:process.env.GOOGLE_MAPS_SERVER_KEY||process.env.GOOGLE_MAPS_API_KEY||process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY||'',
  userAgent:'RouteHub operations geocoding',
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

/**
 * URLSearchParams#get returns null for an omitted value. Number(null) is 0,
 * which previously made an absent geocoding bias look like a real point at
 * 0,0 and caused every Florida result to be rejected as too far away.
 */
export function optionalCoordinateNumber(value:string|null){
  if(value===null||value.trim()==='')return null
  const parsed=Number(value)
  return Number.isFinite(parsed)?parsed:null
}
