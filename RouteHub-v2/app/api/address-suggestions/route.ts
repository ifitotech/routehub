import {NextRequest, NextResponse} from 'next/server'

type CensusMatch = {matchedAddress?: string}
type NominatimMatch = {display_name?: string}
type Suggestion = {label: string; primary: string; secondary: string}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()

// Nominatim is a useful fallback, but without a paid autocomplete provider it
// can return POIs or cities that merely share one word. Rank every result by
// the meaningful parts of what the dispatcher typed and discard weak matches.
const rankLabels = (query: string, labels: string[]) => {
  const terms = normalize(query).split(' ').filter(term => term.length > 1)
  const hasStreetNumber = terms.some(term => /^\d+$/.test(term))
  return labels
    .map(label => {
      const normalized = normalize(label)
      const firstPart = normalize(label.split(',')[0] || label)
      const matched = terms.filter(term => normalized.includes(term))
      const numbers = terms.filter(term => /^\d+$/.test(term))
      const numberMatch = numbers.every(number => firstPart.includes(number))
      const score = matched.length * 12 + (numberMatch ? 20 : 0) + (firstPart.startsWith(terms.slice(0, 2).join(' ')) ? 10 : 0)
      return {label, score, matched: matched.length, numberMatch}
    })
    .filter(result => result.matched >= Math.max(1, Math.ceil(terms.length * .6)) && (!hasStreetNumber || result.numberMatch))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 5)
    .map(result => result.label)
}

const toSuggestions = (labels: string[], query: string): Suggestion[] => {
  const unique = new Set<string>()
  return rankLabels(query, labels).flatMap(label => {
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
      const suggestions = toSuggestions((payload.result?.addressMatches || []).map(match => match.matchedAddress || ''), query)
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
    return NextResponse.json({suggestions: toSuggestions(rows.map(row => row.display_name || ''), query)})
  } catch {
    return NextResponse.json({suggestions: []})
  }
}
