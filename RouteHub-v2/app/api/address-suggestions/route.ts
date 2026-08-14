import {NextRequest, NextResponse} from 'next/server'

type CensusMatch = {matchedAddress?: string}
type NominatimMatch = {display_name?: string}
type Suggestion = {label: string; primary: string; secondary: string}

const toSuggestions = (labels: string[]): Suggestion[] => {
  const unique = new Set<string>()
  return labels.flatMap(label => {
    const normalized = label.trim()
    if (!normalized || unique.has(normalized.toLowerCase())) return []
    unique.add(normalized.toLowerCase())
    const [primary, ...rest] = normalized.split(',')
    return primary ? [{label: normalized, primary: primary.trim(), secondary: rest.join(',').trim()}] : []
  })
}

/** Free US lookup for the beta; server-side avoids Safari CORS failures. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() || ''
  if (query.length < 3 || query.length > 140) return NextResponse.json({suggestions: []})

  try {
    const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
    url.searchParams.set('address', query)
    url.searchParams.set('benchmark', 'Public_AR_Current')
    url.searchParams.set('format', 'json')
    const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(5000)})
    if (response.ok) {
      const payload = await response.json() as {result?: {addressMatches?: CensusMatch[]}}
      const suggestions = toSuggestions((payload.result?.addressMatches || []).map(match => match.matchedAddress || ''))
      if (suggestions.length) return NextResponse.json({suggestions})
    }
  } catch {
    // The independent public fallback below keeps route entry usable.
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '5')
    url.searchParams.set('countrycodes', 'us')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('dedupe', '1')
    url.searchParams.set('q', `${query}, United States`)
    const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(5000), headers: {Accept: 'application/json', 'User-Agent': 'RouteHub Beta address search'}})
    if (!response.ok) return NextResponse.json({suggestions: []})
    const rows = await response.json() as NominatimMatch[]
    return NextResponse.json({suggestions: toSuggestions(rows.map(row => row.display_name || ''))})
  } catch {
    return NextResponse.json({suggestions: []})
  }
}
