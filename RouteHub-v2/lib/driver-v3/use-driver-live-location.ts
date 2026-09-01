'use client'
import {useEffect, useRef} from 'react'
import {distanceMeters, getCurrentLocation, getLocationPermission} from '../location'
import {updateDrivingLocation} from '../driving-session'
import {useDriverData} from './use-driver-data'

/** Reuses V2 GPS architecture while Driving Day is active. Does not change schema. */
export function useDriverLiveLocation() {
  const {drivingSession, driverId, setLiveFix} = useDriverData()
  const last = useRef<{at: number; lat: number; lng: number; accuracy: number; heading: number | null} | null>(null)

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
        // Keep Friday's driving behavior: accept normal movement immediately,
        // but do not let a weak or impossible GPS jump pull the driver off route.
        if (previous && ((muchWorseThanPrevious && !materiallyMorePrecise) || (distance > allowedTravel && !materiallyMorePrecise))) return
        last.current = {at: now, ...next}
        const at = new Date(now).toISOString()
        setLiveFix({lat: next.lat, lng: next.lng, accuracy: next.accuracy, heading: next.heading, at})
        void updateDrivingLocation(drivingSession.id, driverId, next).catch(() => {
          // The on-screen fix remains useful while a temporary network write retries on the next update.
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
