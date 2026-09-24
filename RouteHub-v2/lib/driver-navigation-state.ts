'use client'

const STORAGE_KEY = 'routehub:driver-navigation-active:v1'
export const DRIVER_NAVIGATION_STATE_EVENT = 'routehub:driver-navigation-state'

export function getDriverNavigationRouteId() {
  if (typeof window === 'undefined') return null
  try { return window.sessionStorage.getItem(STORAGE_KEY) } catch { return null }
}

export function setDriverNavigationRouteId(routeId: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (routeId) window.sessionStorage.setItem(STORAGE_KEY, routeId)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* session storage is optional */ }
  window.dispatchEvent(new CustomEvent(DRIVER_NAVIGATION_STATE_EVENT, {detail: {routeId}}))
}
