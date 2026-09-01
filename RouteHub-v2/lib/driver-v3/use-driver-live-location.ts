'use client'
import {useEffect, useRef} from 'react'
import {getCurrentLocation, getLocationPermission} from '../location'
import {updateDrivingLocation} from '../driving-session'
import {useDriverData} from './use-driver-data'

/** Reuses V2 GPS architecture while Driving Day is active. Does not change schema. */
export function useDriverLiveLocation() {
  const {drivingSession, driverId, setLiveFix} = useDriverData()
  const last = useRef<{at: number; lat: number; lng: number; accuracy: number} | null>(null)

  useEffect(() => {
    if (!drivingSession || !driverId || typeof navigator === 'undefined' || !navigator.geolocation) return
    let disposed = false
    let wake: WakeLockSentinel | null = null

    const send = async () => {
      try {
        const permission = await getLocationPermission()
        if (permission === 'denied') return
        const location = await getCurrentLocation({maximumAge: 0})
        if (disposed) return
        await updateDrivingLocation(drivingSession.id, driverId, location)
        setLiveFix({lat: location.lat, lng: location.lng, at: new Date().toISOString()})
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

    void send()
    void holdScreen()
    const interval = window.setInterval(() => void send(), 5 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void send()
        void holdScreen()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    const watch = navigator.geolocation.watchPosition(
      position => {
        if (disposed) return
        const next = {lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy}
        const previous = last.current
        const elapsed = Date.now() - (previous?.at || 0)
        const materiallyMorePrecise = Boolean(
          previous &&
          Number.isFinite(next.accuracy) &&
          Number.isFinite(previous.accuracy) &&
          next.accuracy + 15 < previous.accuracy,
        )
        const moved =
          !previous ||
          Math.hypot((next.lat - previous.lat) * 111_000, (next.lng - previous.lng) * 111_000 * Math.cos((next.lat * Math.PI) / 180)) >= 25
        if (!materiallyMorePrecise && ((moved && elapsed < 10_000) || (!moved && elapsed < 60_000))) return
        last.current = {at: Date.now(), lat: next.lat, lng: next.lng, accuracy: next.accuracy}
        void updateDrivingLocation(drivingSession.id, driverId, next).then(() => {
          setLiveFix({lat: next.lat, lng: next.lng, at: new Date().toISOString()})
        })
      },
      () => undefined,
      {enableHighAccuracy: true, maximumAge: 0, timeout: 20000},
    )

    return () => {
      disposed = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
      navigator.geolocation.clearWatch(watch)
      void wake?.release()
    }
  }, [drivingSession, driverId, setLiveFix])
}
