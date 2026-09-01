/** Stable, human-readable route reference. The UUID remains the authoritative key. */
export function routeNumber(route: { id?: string | null; route_number?: string | null }) {
  if (route.route_number?.trim()) return route.route_number.trim()
  const compact = String(route.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()
  return compact ? `RH-${compact}` : 'RH-UNKNOWN'
}
