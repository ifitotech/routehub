'use client'
import {useEffect} from 'react'
import {startGpsWarmup, stopGpsWarmup} from '../../lib/driver-v3/gps-warmup'

/**
 * Starts warming up the device's GPS the moment the Driver app opens, not
 * only once a route is started - so a fix is already cached by the time
 * navigation actually needs one. Purely local (never shares location); only
 * activates if the browser already has permission, so it never prompts.
 */
export default function DriverGpsWarmup() {
  useEffect(() => {
    void startGpsWarmup()
    return () => stopGpsWarmup()
  }, [])
  return null
}
