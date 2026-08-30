'use client'

import {useEffect} from 'react'

/** Marks the document as Driver app mode for the whole V3 session. */
export default function DriverV3AppMode() {
  useEffect(() => {
    document.documentElement.dataset.driverApp = 'v3'
    document.body.dataset.driverApp = 'v3'
    // Keep the visual viewport from bouncing the browser chrome on iOS
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      delete document.documentElement.dataset.driverApp
      delete document.body.dataset.driverApp
      document.body.style.overflow = prevOverflow
    }
  }, [])
  return null
}
