'use client'

import {useEffect} from 'react'

const SERVICE_WORKER_URL = '/sw.js?v=29'
const NAVIGATION_STATE_KEY = 'routehub:driver-navigation-active:v1'
const UPDATE_PENDING_KEY = 'routehub:sw-update-pending:v1'

export default function PwaRegister() {
  useEffect(() => {
    // Standalone PWAs and supported mobile browsers can lock the document to
    // portrait. Native Android is additionally locked in AndroidManifest.xml;
    // iOS simply ignores this promise when its WebKit build does not expose
    // Screen Orientation API.
    const lockPortrait = () => {
      const orientation = window.screen.orientation as ScreenOrientation & {
        lock?: (value: 'portrait-primary' | 'portrait') => Promise<void>
      }
      if (typeof orientation?.lock === 'function') void orientation.lock('portrait-primary').catch(() => {})
    }
    // Lock once when the document is ready. Calling lock() from an
    // orientationchange handler makes WebView/WebKit re-layout twice and can
    // visibly freeze the driver screen for a few seconds after rotating.
    lockPortrait()
    const onInstallPrompt = (event: Event) => {
      event.preventDefault()
      window.dispatchEvent(new CustomEvent('routehub:install-available', {detail: event}))
    }
    window.addEventListener('beforeinstallprompt', onInstallPrompt)
    if (!('serviceWorker' in navigator)) return
    let registration: ServiceWorkerRegistration | undefined
    let active = true

    const update = () => {
      // A normal offline launch must not bubble a worker update rejection to
      // the global error reporter every minute. The next online/focus event
      // retries the same check.
      if (document.visibilityState === 'visible') void registration?.update().catch(() => {})
    }

    // Version the script URL as well as the cache name. Some iOS PWA
    // installations keep the old registration when only the script body
    // changes, so the query forces a fresh worker check.
    navigator.serviceWorker.register(SERVICE_WORKER_URL, {updateViaCache: 'none'}).then(value => {
      if (!active) return
      registration = value
      void value.update().catch(() => {})
      if (value.waiting) value.waiting.postMessage('SKIP_WAITING')
      value.addEventListener('updatefound', () => {
        const worker = value.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) worker.postMessage('SKIP_WAITING')
        })
      })
    }).catch(() => {})

    // Mobile browsers may suspend the page and skip the normal focus event.
    // Check when visibility returns and periodically while the app is open so
    // a deployed worker is picked up without asking the driver to reinstall.
    const onVisibilityChange = () => update()
    document.addEventListener('visibilitychange', onVisibilityChange)
    const updateTimer = window.setInterval(update, 60_000)

    const reloadForUpdate = () => {
      if (sessionStorage.getItem('routehub_sw_reloaded') === '1') return
      sessionStorage.setItem('routehub_sw_reloaded', '1')
      window.location.reload()
    }
    const onControllerChange = () => {
      // Never interrupt a driver who is already navigating. The new worker
      // can safely control the document while its current JS stays alive;
      // reload as soon as the driver returns to Today instead.
      if (sessionStorage.getItem(NAVIGATION_STATE_KEY)) {
        sessionStorage.setItem(UPDATE_PENDING_KEY, '1')
        return
      }
      reloadForUpdate()
    }
    const onNavigationState = (event: Event) => {
      const routeId = (event as CustomEvent<{routeId?: string | null}>).detail?.routeId
      if (routeId || sessionStorage.getItem(UPDATE_PENDING_KEY) !== '1') return
      sessionStorage.removeItem(UPDATE_PENDING_KEY)
      reloadForUpdate()
    }
    const clearReloadGuard = () => sessionStorage.removeItem('routehub_sw_reloaded')
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    window.addEventListener('routehub:driver-navigation-state', onNavigationState)
    window.addEventListener('online', update)
    window.addEventListener('focus', update)
    window.addEventListener('pageshow', clearReloadGuard, {once: true})
    return () => {
      active = false
      window.removeEventListener('beforeinstallprompt', onInstallPrompt)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('routehub:driver-navigation-state', onNavigationState)
      window.removeEventListener('online', update)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(updateTimer)
    }
  }, [])
  return null
}
