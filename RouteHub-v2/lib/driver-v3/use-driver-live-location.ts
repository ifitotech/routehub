'use client'

import {useEffect, useState} from 'react'
import {canStartBackgroundGps, distanceMeters, getCurrentLocation, getLocationPermission} from '../location'
import {updateDrivingLocation} from '../driving-session'
import {startNativeLocationTracking, stopNativeLocationTracking} from '../native-location-tracking'
import {getDriverNavigationRouteId, DRIVER_NAVIGATION_STATE_EVENT} from '../driver-navigation-state'
import {getDriverModePreference} from '../driver-mode-preference'
import {getNavigationPreference} from '../navigation-preference'
import {resolveDriverExperience} from '../driver-premium'
import {useDriverData} from './use-driver-data'

/**
 * Shares location only while a started route is being navigated in RouteHub
 * and the PWA/app is visible. Driving Day by itself never starts GPS.
 */
export function useDriverLiveLocation() {
  const {drivingSession, driverId, companyPlan, routes, setLiveFix} = useDriverData()
  const [navigationRouteId, setNavigationRouteId] = useState<string | null>(null)
  const [pageVisible, setPageVisible] = useState(false)
  const activeRoute = routes.find(route => route.status === 'active')
  const experience = resolveDriverExperience(getDriverModePreference(), getNavigationPreference(), companyPlan)
  const sessionId = drivingSession?.id
  const activeRouteId = activeRoute?.id
  const canShareLocation = Boolean(
    activeRouteId && sessionId && experience.mode === 'pro' && experience.navigation === 'internal' &&
    navigationRouteId === activeRouteId && pageVisible,
  )

  useEffect(() => {
    const readNavigation = (event?: Event) => {
      const routeId = (event as CustomEvent<{routeId?: string | null}> | undefined)?.detail?.routeId
      setNavigationRouteId(routeId === undefined ? getDriverNavigationRouteId() : routeId)
    }
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible')
    readNavigation()
    onVisibility()
    window.addEventListener(DRIVER_NAVIGATION_STATE_EVENT, readNavigation)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener(DRIVER_NAVIGATION_STATE_EVENT, readNavigation)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!canShareLocation || !sessionId || !driverId || !activeRouteId) {
      setLiveFix(null)
      void stopNativeLocationTracking().catch(() => {})
      return
    }

    let disposed = false
    let wake: WakeLockSentinel | null = null
    let watch: number | null = null
    let interval = 0
    let previous: {at: number; lat: number; lng: number; accuracy: number} | null = null

    const mayShareNow = () => !disposed && document.visibilityState === 'visible' && getDriverNavigationRouteId() === activeRouteId
    const send = async () => {
      try {
        if (!mayShareNow()) return
        const permission = await getLocationPermission()
        if (!canStartBackgroundGps(permission) || !mayShareNow()) return
        const location = await getCurrentLocation({maximumAge: 15_000})
        if (!mayShareNow()) return
        await updateDrivingLocation(sessionId, driverId, location)
        if (mayShareNow()) setLiveFix({...location, heading: null, at: new Date().toISOString()})
      } catch {
        // GPS can fail temporarily; route controls continue to work.
      }
    }

    const holdScreen = async () => {
      try {
        if (!mayShareNow() || !('wakeLock' in navigator)) return
        wake = await navigator.wakeLock.request('screen')
      } catch { /* Some browsers require an explicit gesture. */ }
    }

    const startWatch = () => {
      if (watch != null || !navigator.geolocation || !mayShareNow()) return
      watch = navigator.geolocation.watchPosition(position => {
        if (!mayShareNow()) return
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }
        if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng) || !Number.isFinite(next.accuracy)) return
        const now = Date.now()
        const elapsedSeconds = previous ? Math.max(1, (now - previous.at) / 1000) : 0
        const materiallyMorePrecise = Boolean(previous && next.accuracy + 15 < previous.accuracy)
        const distance = previous ? distanceMeters(previous, next) : 0
        const allowedTravel = Math.max(40, elapsedSeconds * 45 + (next.accuracy + (previous?.accuracy || 0)) * 1.5)
        const muchWorse = Boolean(previous && next.accuracy > Math.max(75, previous.accuracy * 1.8))
        if (previous && ((muchWorse && !materiallyMorePrecise) || (distance > allowedTravel && !materiallyMorePrecise))) return
        previous = {at: now, ...next}
        const at = new Date(now).toISOString()
        setLiveFix({...next, heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null, at})
        void updateDrivingLocation(sessionId, driverId, next).catch(() => {})
      }, () => undefined, {enableHighAccuracy: true, maximumAge: 0, timeout: 20_000})
    }

    void (async () => {
      setLiveFix(null) // discard the previous session's point before reacquiring
      const permission = await getLocationPermission()
      if (disposed || !mayShareNow() || !canStartBackgroundGps(permission)) return
      try {
        const nativeStarted = await startNativeLocationTracking({sessionId, driverId, intervalMinutes: 5})
        if (nativeStarted) return
      } catch {
        // Browser/PWA foreground tracking remains available.
      }
      if (disposed || !mayShareNow() || !navigator.geolocation) return
      void send()
      void holdScreen()
      startWatch()
      interval = window.setInterval(() => void send(), 5 * 60 * 1000)
    })()

    return () => {
      disposed = true
      if (interval) window.clearInterval(interval)
      if (watch != null && navigator.geolocation) navigator.geolocation.clearWatch(watch)
      void wake?.release()
      void stopNativeLocationTracking().catch(() => {})
    }
  }, [canShareLocation, activeRouteId, driverId, sessionId, setLiveFix])
}
