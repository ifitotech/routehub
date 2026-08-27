/**
 * Public-safe map settings. Keeping these values here lets RouteHub switch
 * tile or routing providers later without changing Leaflet components.
 */
export const mapTileConfig={
  url:process.env.NEXT_PUBLIC_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
} as const

/** Low-volume beta endpoint only; replace through this variable before scaling. */
export const routingConfig={
  endpoint:(process.env.NEXT_PUBLIC_ROUTING_ENDPOINT||'https://router.project-osrm.org').replace(/\/$/,'')
} as const

/** Server-side geocoding providers used by the controlled beta search routes. */
export const geocodingConfig={
  censusEndpoint:'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress',
  nominatimEndpoint:'https://nominatim.openstreetmap.org/search',
  userAgent:'RouteHub Beta location search',
  requestTimeoutMs:5000
} as const

export const mapProviderLimits={
  minimumSearchCharacters:3,
  maximumSearchCharacters:180,
  routeTimeoutMs:8000
} as const
