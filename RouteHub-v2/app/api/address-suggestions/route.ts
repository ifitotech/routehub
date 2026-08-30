import {NextRequest, NextResponse} from 'next/server'
import {floridaBounds,geocodingConfig,isInFlorida,mapProviderLimits,withFloridaQuery} from '../../../lib/maps/map-config'

type CensusMatch = {matchedAddress?: string; coordinates?: {x?: number; y?: number}}
type NominatimMatch = {display_name?: string; lat?: string; lon?: string; place_id?: number; osm_type?: string; osm_id?: number; name?: string}
type Coordinate = {lat: number; lng: number}
type LocationSource = 'census' | 'nominatim'
type Suggestion = {label: string; primary: string; secondary: string; coordinate?: Coordinate; source: LocationSource; externalId?: string; name?: string}

const CACHE_TTL_MS = 15 * 60 * 1000
const cache = new Map<string, {expiresAt: number; suggestions: Suggestion[]}>()
let lastNominatimRequestAt = 0

const normalize = (value: string) => value.toLowerCase()
  // Treat common ordinal street forms as their numeric equivalent (33 Pl = 33rd Pl).
  .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
  .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
const validCoordinate = (coordinate: Coordinate | undefined): coordinate is Coordinate => Boolean(coordinate && Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng) && coordinate.lat >= -90 && coordinate.lat <= 90 && coordinate.lng >= -180 && coordinate.lng <= 180)

function splitLabel(label: string) {
  const [primary, ...rest] = label.split(',')
  return {primary: primary?.trim() || label.trim(), secondary: rest.join(',').trim()}
}

function scoreResult(query: string, label: string) {
  const terms = normalize(query).split(' ').filter(term => term.length > 1)
  const normalized = normalize(label)
  const firstPart = normalize(label.split(',')[0] || label)
  const numbers = terms.filter(term => /^\d+$/.test(term))
  const matched = terms.filter(term => normalized.includes(term))
  // Street numbers and ZIP codes can appear in different comma-separated
  // parts of a provider label. Matching only the first part incorrectly
  // discarded valid street+ZIP searches.
  const numberMatch = numbers.every(number => normalized.includes(number))
  const score = matched.length * 12 + (numberMatch ? 20 : 0) + (firstPart.startsWith(terms.slice(0, 2).join(' ')) ? 10 : 0)
  return {score, matched: matched.length, numberMatch, requiresNumber: numbers.length > 0, minimumMatches: Math.max(1, Math.ceil(terms.length * .6))}
}

function rankSuggestions(query: string, candidates: Suggestion[]) {
  const unique = new Set<string>()
  return candidates
    .map(candidate => ({candidate, ...scoreResult(query, candidate.label)}))
    .filter(result => result.matched >= result.minimumMatches && (!result.requiresNumber || result.numberMatch))
    .sort((a, b) => b.score - a.score || a.candidate.label.localeCompare(b.candidate.label))
    .flatMap(result => {
      const key = `${normalize(result.candidate.label)}:${result.candidate.coordinate?.lat ?? ''}:${result.candidate.coordinate?.lng ?? ''}`
      if (!result.candidate.label || unique.has(key)) return []
      unique.add(key)
      return [result.candidate]
    })
    .slice(0, 5)
}

function cacheKey(query: string, near: string) { return `${normalize(query)}|${normalize(near)}` }
function response(suggestions: Suggestion[]) { return NextResponse.json({suggestions}, {headers: {'Cache-Control': 'private, max-age=300'}}) }

/**
 * Controlled, explicit beta location lookup. This route is deliberately not
 * intended for type-ahead use: callers invoke it after selecting Search/Enter;
 * saved RouteHub contacts and branches are handled in the client first.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() || ''
  const near = request.nextUrl.searchParams.get('near')?.trim() || ''
  if (query.length < mapProviderLimits.minimumSearchCharacters || query.length > mapProviderLimits.maximumSearchCharacters) return response([])

  const key = cacheKey(query, near)
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return response(cached.suggestions)

  const contextualQuery = withFloridaQuery(near ? `${query}, ${near}` : query)
  let suggestions: Suggestion[] = []

  try {
    const url = new URL(geocodingConfig.censusEndpoint)
    url.searchParams.set('address', contextualQuery)
    url.searchParams.set('benchmark', 'Public_AR_Current')
    url.searchParams.set('format', 'json')
    const censusResponse = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(geocodingConfig.requestTimeoutMs)})
    if (censusResponse.ok) {
      const payload = await censusResponse.json() as {result?: {addressMatches?: CensusMatch[]}}
      suggestions = rankSuggestions(query, (payload.result?.addressMatches || []).map(match => {
        const label = match.matchedAddress?.trim() || ''
        const coordinate = {lat: Number(match.coordinates?.y), lng: Number(match.coordinates?.x)}
        return {...splitLabel(label), label, coordinate: validCoordinate(coordinate) ? coordinate : undefined, source: 'census' as const}
      }).filter(candidate => validCoordinate(candidate.coordinate) && isInFlorida(candidate.coordinate.lat, candidate.coordinate.lng)))
    }
  } catch {
    // RouteHub still permits manual address entry when lookup is unavailable.
  }

  if (!suggestions.length && Date.now() - lastNominatimRequestAt >= 1_100) {
    try {
      lastNominatimRequestAt = Date.now()
      const url = new URL(geocodingConfig.nominatimEndpoint)
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('limit', '5')
      url.searchParams.set('countrycodes', 'us')
      url.searchParams.set('addressdetails', '1')
      url.searchParams.set('dedupe', '1')
      url.searchParams.set('viewbox', `${floridaBounds.west},${floridaBounds.north},${floridaBounds.east},${floridaBounds.south}`)
      url.searchParams.set('bounded', '1')
      url.searchParams.set('q', contextualQuery)
      const nominatimResponse = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(geocodingConfig.requestTimeoutMs), headers: {Accept: 'application/json', 'User-Agent': geocodingConfig.userAgent}})
      if (nominatimResponse.ok) {
        const rows = await nominatimResponse.json() as NominatimMatch[]
        suggestions = rankSuggestions(query, rows.map(row => {
          const label = row.display_name?.trim() || ''
          const coordinate = {lat: Number(row.lat), lng: Number(row.lon)}
          return {
            ...splitLabel(label), label,
            coordinate: validCoordinate(coordinate) ? coordinate : undefined,
            source: 'nominatim' as const,
            externalId: row.osm_type && row.osm_id ? `${row.osm_type}:${row.osm_id}` : row.place_id?.toString(),
            name: row.name?.trim() || undefined,
          }
        }).filter(candidate => validCoordinate(candidate.coordinate) && isInFlorida(candidate.coordinate!.lat, candidate.coordinate!.lng)))
      }
    } catch {
      // Manual address entry is always a supported fallback.
    }
  }

  cache.set(key, {expiresAt: Date.now() + CACHE_TTL_MS, suggestions})
  return response(suggestions)
}
