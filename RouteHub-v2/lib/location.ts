export type Coordinates = {lat: number; lng: number; accuracy: number}
export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

// Kept as "_SESSION" in the key name for backward compatibility with values
// already written to storage on installed devices - it now lives in
// localStorage, not sessionStorage, so it survives fully closing and
// reopening the PWA (see markGeoGranted/canStartBackgroundGps below).
export const GEO_OK_SESSION = 'routehub_geo_ok'
export const GEO_DENIED = 'routehub_geo_denied'

/** Reads the browser permission without opening another prompt. */
export async function getLocationPermission(): Promise<LocationPermission> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported'
  if (!navigator.permissions?.query) return 'prompt'
  try {
    return (await navigator.permissions.query({name: 'geolocation' as PermissionName})).state as LocationPermission
  } catch {
    return 'prompt'
  }
}

// iOS Safari's Permissions API for geolocation is unreliable - it commonly
// reports 'prompt' even once the user has actually granted access, so
// getLocationPermission() alone cannot be trusted to say "already granted".
// This flag is the fallback: once a location request has genuinely
// succeeded once, remember it durably (localStorage, not sessionStorage) so
// a driver who granted access does not see the app treat every fresh PWA
// launch as if it were asking for the first time again.
export function markGeoGranted() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GEO_OK_SESSION, '1')
  window.localStorage.removeItem(GEO_DENIED)
}

export function markGeoDenied() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GEO_DENIED, '1')
}

export function isGeoDenied() {
  return typeof window !== 'undefined' && window.localStorage.getItem(GEO_DENIED) === '1'
}

/** True when background GPS may run without opening a new OS prompt. */
export function canStartBackgroundGps(permission: LocationPermission) {
  if (permission === 'granted') return true
  if (permission === 'denied' || permission === 'unsupported' || isGeoDenied()) return false
  return typeof window !== 'undefined' && window.localStorage.getItem(GEO_OK_SESSION) === '1'
}

export function getCurrentLocation(options: {maximumAge?: number} = {}): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Location is not available.'))
    }
    navigator.geolocation.getCurrentPosition(
      p => {
        markGeoGranted()
        resolve({lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy})
      },
      e => {
        if (e.code === 1) markGeoDenied()
        reject(new Error(e.code === 1 ? 'Location permission was denied.' : 'Unable to get your location.'))
      },
      {enableHighAccuracy: true, timeout: 12000, maximumAge: options.maximumAge ?? 10000},
    )
  })
}

export function distanceMeters(a: {lat: number; lng: number}, b: {lat: number; lng: number}) {
  const radius = 6371000
  const toRad = (n: number) => (n * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
export function withinRadius(distance: number, radius = 300) {
  return distance <= radius
}
export function completionWarning(distance: number, radius = 300) {
  return distance <= radius ? null : `Completed ${Math.round(distance)} m from destination.`
}
