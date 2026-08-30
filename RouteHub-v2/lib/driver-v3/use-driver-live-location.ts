'use client'
import {useEffect, useRef} from 'react'
import {getCurrentLocation, getLocationPermission} from '../location'
import {updateDrivingLocation} from '../driving-session'
import {useDriverData} from './use-driver-data'

/** Reuses V2 GPS architecture while Driving Day is active. Does not change schema. */
export function useDriverLiveLocation() {
  const {drivingSession, driverId} = useDriverData()
  const last = useRef<{at: number; lat: number; lng: number} | null>(null)

  useEffect(() => {
    if (!drivingSession || !driverId || typeof navigator === 'undefined' || !navigator.geolocation) return
    let disposed = false

    const send = async () => {
      try {
        const permission = await getLocationPermission()
        if (permission === 'denied') return
        const location = await getCurrentLocation({maximumAge: 0})
        if (disposed) return
        await updateDrivingLocation(drivingSession.id, driverId, location)
      } catch {
        /* Location optional; driver can keep working. */
      }
    }

    void send()
    const interval = window.setInterval(() => void send(), 5 * 60 * 1000)
    const watch = navigator.geolocation.watchPosition(
      position => {
        if (disposed) return
        const next = {lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy}
        const previous = last.current
        const elapsed = Date.now() - (previous?.at || 0)
        const moved =
          !previous ||
          Math.hypot((next.lat - previous.lat) * 111_000, (next.lng - previous.lng) * 111_000 * Math.cos((next.lat * Math.PI) / 180)) >= 25
        if ((moved && elapsed < 10_000) || (!moved && elapsed < 60_000)) return
        last.current = {at: Date.now(), lat: next.lat, lng: next.lng}
        void updateDrivingLocation(drivingSession.id, driverId, next)
      },
      () => undefined,
      {enableHighAccuracy: true, maximumAge: 0, timeout: 20000},
    )

    return () => {
      disposed = true
      window.clearInterval(interval)
      navigator.geolocation.clearWatch(watch)
    }
  }, [drivingSession, driverId])
}
