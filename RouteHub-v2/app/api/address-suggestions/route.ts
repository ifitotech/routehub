import {NextRequest, NextResponse} from 'next/server'
import {geocodingConfig,isInFlorida,mapProviderLimits,withFloridaQuery} from '../../../lib/maps/map-config'

type GoogleMatch = {formatted_address?: string; place_id?: string; geometry?: {location?: {lat?: number; lng?: number}}}
type Coordinate = {lat: number; lng: number}
type LocationSource = 'google'
type Suggestion = {label: string; primary: string; secondary: string; coordinate?: Coordinate; source: LocationSource; externalId?: string; name?: string}

const CACHE_TTL_MS = 15 * 60 * 1000
const cache = new Map<string, {expiresAt: number; suggestions: Suggestion[]}>()

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
 * Controlled Google address lookup. Browser Places Autocomplete remains the
 * first choice; this endpoint keeps explicit Search/Enter usable with the
 * same provider when Places is unavailable.
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
  if (geocodingConfig.googleKey) {
    try {
      const url = new URL(geocodingConfig.googleGeocodeEndpoint)
      url.searchParams.set('address', contextualQuery)
      url.searchParams.set('components', 'country:US|administrative_area:FL')
      url.searchParams.set('region', 'us')
      url.searchParams.set('key', geocodingConfig.googleKey)
      const googleResponse = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(geocodingConfig.requestTimeoutMs)})
      if (googleResponse.ok) {
        const payload = await googleResponse.json() as {status?: string; results?: GoogleMatch[]}
        if (payload.status === 'OK') {
          suggestions = rankSuggestions(query, (payload.results || []).map(match => {
            const label = match.formatted_address?.trim() || ''
            const coordinate = {lat: Number(match.geometry?.location?.lat), lng: Number(match.geometry?.location?.lng)}
            return {...splitLabel(label), label, coordinate: validCoordinate(coordinate) ? coordinate : undefined, source: 'google' as const, externalId: match.place_id}
          }).filter(candidate => validCoordinate(candidate.coordinate) && isInFlorida(candidate.coordinate.lat, candidate.coordinate.lng)))
        }
      }
    } catch {
      // Manual address entry remains available when Google lookup is unavailable.
    }
  }

  cache.set(key, {expiresAt: Date.now() + CACHE_TTL_MS, suggestions})
  return response(suggestions)
}
