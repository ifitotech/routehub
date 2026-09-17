'use client'

export type NavigationPreference = 'internal' | 'external'

const NAVIGATION_PREFERENCE_KEY = 'routehub:navigation-preference'

/** The selected navigator belongs to this device, not a route or company. */
export function getNavigationPreference(): NavigationPreference {
  if (typeof window === 'undefined') return 'internal'
  try {
    return window.localStorage.getItem(NAVIGATION_PREFERENCE_KEY) === 'external' ? 'external' : 'internal'
  } catch {
    return 'internal'
  }
}

export function setNavigationPreference(value: NavigationPreference) {
  try { window.localStorage.setItem(NAVIGATION_PREFERENCE_KEY, value) } catch { /* storage can be unavailable in private mode */ }
}
