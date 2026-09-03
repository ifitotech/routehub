'use client'
import {useEffect, useRef} from 'react'
import {
  canStartBackgroundGps,
  distanceMeters,
  getCurrentLocation,
  getLocationPermission,
} from '../location'
import {updateDrivingLocation} from '../driving-session'
import {useDriverData} from './use-driver-data'

/** Live GPS only while Driving Day is active AND the OS already allows it. */
export function useDriverLiveLocation() {
  const {drivingSession, driverId, setLiveFix} = useDriverData()
  const last = useRef<{at: number; lat: number; lng: number; accuracy: number; heading: number | null} | null>(null)
  const sessionId = drivingSession?.id

  useEffect(() => {
    if (!drivingSession || !driverId || typeof navigator === 'undefined' || !navigator.geolocation) return
    let disposed = false
    let wake: WakeLockSentinel | null = null
    let watch: number | null = null
    let interval = 0

    if (drivingSession.last_lat != null && drivingSession.last_lng != null) {
      setLiveFix({
        lat: Number(drivingSession.last_lat),
        lng: Number(drivingSession.last_lng),
        at: drivingSession.last_updated_at || new Date().toISOString(),
      })
    }

    const send = async () => {
      try {
        const permission = await getLocationPermission()
        if (!canStartBackgroundGps(permission)) return
        const location = await getCurrentLocation({maximumAge: 30_000})
        if (disposed) return
        await updateDrivingLocation(drivingSession.id, driverId, location)
        setLiveFix({lat: location.lat, lng: location.lng, accuracy: location.accuracy, heading: null, at: new Date().toISOString()})
      } catch {
        /* Location optional; driver can keep working. */
      }
    }

    const holdScreen = async () => {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
        wake = await navigator.wakeLock.request('screen')
      } catch {
        /* Some browsers block wake lock without a gesture. */
      }
    }

    const startWatch = () => {
      if (watch != null) return
      watch = navigator.geolocation.watchPosition(
        position => {
          if (disposed) return
          const next = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          }
          if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng) || !Number.isFinite(next.accuracy)) return
          const previous = last.current
          const now = Date.now()
          const elapsedSeconds = previous ? Math.max(1, (now - previous.at) / 1000) : 0
          const materiallyMorePrecise = Boolean(
            previous &&
              Number.isFinite(next.accuracy) &&
              Number.isFinite(previous.accuracy) &&
              next.accuracy + 15 < previous.accuracy,
          )
          const distance = previous ? distanceMeters(previous, next) : 0
          const allowedTravel = Math.max(40, elapsedSeconds * 45 + (next.accuracy + (previous?.accuracy || 0)) * 1.5)
          const muchWorseThanPrevious = Boolean(previous && next.accuracy > Math.max(75, previous.accuracy * 1.8))
          if (previous && ((muchWorseThanPrevious && !materiallyMorePrecise) || (distance > allowedTravel && !materiallyMorePrecise))) return
          last.current = {at: now, ...next}
          const at = new Date(now).toISOString()
          setLiveFix({lat: next.lat, lng: next.lng, accuracy: next.accuracy, heading: next.heading, at})
          void updateDrivingLocation(drivingSession.id, driverId, next).catch(() => {})
        },
        () => undefined,
        {enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000},
      )
    }

    void (async () => {
      const permission = await getLocationPermission()
      if (disposed) return
      if (!canStartBackgroundGps(permission)) return
      void send()
      void holdScreen()
      startWatch()
      interval = window.setInterval(() => void send(), 5 * 60 * 1000)
    })()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void holdScreen()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      disposed = true
      if (interval) window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      if (watch != null) navigator.geolocation.clearWatch(watch)
      void wake?.release()
    }
  }, [sessionId, driverId, setLiveFix, drivingSession])
}
