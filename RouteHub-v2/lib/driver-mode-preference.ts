'use client'

export type DriverMode = 'simple' | 'pro'

const DRIVER_MODE_KEY = 'routehub:driver-mode'

/** Presentation preference belongs to this device. It does not choose the map app. */
export function getDriverModePreference(): DriverMode {
  if (typeof window === 'undefined') return 'pro'
  try { return window.localStorage.getItem(DRIVER_MODE_KEY) === 'simple' ? 'simple' : 'pro' } catch { return 'pro' }
}

export function setDriverModePreference(value: DriverMode) {
  try { window.localStorage.setItem(DRIVER_MODE_KEY, value) } catch { /* storage can be unavailable */ }
}
