'use client'

import {canStartBackgroundGps, getLocationPermission} from '../location'

export type WarmGpsFix = {lat: number; lng: number; accuracy: number; heading: number | null; updatedAt: number}

// Module-level, not component state: this needs to survive the Today page
// mounting/unmounting and being mounted again the moment navigation opens,
// so the fix acquired while the driver was just looking at Today is still
// there for driver-navigation-map.tsx's very first render instead of that
// component starting its own watchPosition from a cold, null location.
let cachedFix: WarmGpsFix | null = null
let watchId: number | null = null
let starting = false

/** A recent-enough fix to seed navigation's own GPS state with immediately. */
export function getWarmGpsFix(maxAgeMs = 20000): WarmGpsFix | null {
  if (!cachedFix) return null
  return Date.now() - cachedFix.updatedAt <= maxAgeMs ? cachedFix : null
}

/**
 * Keeps the OS location radio warm and a recent fix cached in memory for the
 * whole Driver session - purely local, never sent anywhere. This does not
 * replace useDriverLiveLocation's route-sharing watch (which still only runs
 * while a started route is being navigated, by design, for privacy/battery)
 * and it never prompts for permission on its own - it only starts once the
 * browser already reports geolocation as granted or session-approved.
 */
export async function startGpsWarmup() {
  if (starting || watchId != null || typeof navigator === 'undefined' || !navigator.geolocation) return
  starting = true
  try {
    const permission = await getLocationPermission()
    if (!canStartBackgroundGps(permission)) return
    watchId = navigator.geolocation.watchPosition(
      position => {
        cachedFix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          updatedAt: Date.now(),
        }
      },
      () => undefined,
      {enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000},
    )
  } finally {
    starting = false
  }
}

export function stopGpsWarmup() {
  if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
  watchId = null
}
