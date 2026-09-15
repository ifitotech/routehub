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
    // 100dvh should already track the real, chrome-free viewport height in
    // an installed PWA, but some WebKit builds settle on a stale value after
    // a route change or keyboard dismissal - the bottom nav then sits a bit
    // short of the actual bottom edge, floating above empty space. Track the
    // real height ourselves as a fallback the .shell height calc can prefer.
    const setAppHeight = () => document.documentElement.style.setProperty('--app-1vh', `${window.innerHeight * 0.01}px`)
    setAppHeight()
    window.addEventListener('resize', setAppHeight)
    window.addEventListener('orientationchange', setAppHeight)
    return () => {
      delete document.documentElement.dataset.driverApp
      delete document.body.dataset.driverApp
      document.body.style.overflow = prevOverflow
      window.removeEventListener('resize', setAppHeight)
      window.removeEventListener('orientationchange', setAppHeight)
    }
  }, [])
  return null
}
