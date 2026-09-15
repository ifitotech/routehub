'use client'

import {useEffect} from 'react'

export default function PwaRegister() {
  useEffect(() => {
    // Standalone PWAs and supported mobile browsers can lock the document to
    // portrait. Native Android is additionally locked in AndroidManifest.xml;
    // iOS simply ignores this promise when its WebKit build does not expose
    // Screen Orientation API.
    const lockPortrait = () => {
      const orientation = window.screen.orientation as ScreenOrientation & {
        lock?: (value: OrientationLockType) => Promise<void>
      }
      if (typeof orientation?.lock === 'function') void orientation.lock('portrait-primary').catch(() => {})
    }
    lockPortrait()
    window.addEventListener('orientationchange', lockPortrait)
    const onInstallPrompt = (event: Event) => {
      event.preventDefault()
      window.dispatchEvent(new CustomEvent('routehub:install-available', {detail: event}))
    }
    window.addEventListener('beforeinstallprompt', onInstallPrompt)
    if (!('serviceWorker' in navigator)) return
    let registration: ServiceWorkerRegistration | undefined
    let active = true

    const update = () => {
      if (document.visibilityState === 'visible') void registration?.update()
    }

    navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'}).then(value => {
      if (!active) return
      registration = value
      void value.update()
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

    const onControllerChange = () => {
      if (sessionStorage.getItem('routehub_sw_reloaded') === '1') return
      sessionStorage.setItem('routehub_sw_reloaded', '1')
      window.location.reload()
    }
    const clearReloadGuard = () => sessionStorage.removeItem('routehub_sw_reloaded')
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    window.addEventListener('online', update)
    window.addEventListener('focus', update)
    window.addEventListener('pageshow', clearReloadGuard, {once: true})
    return () => {
      active = false
      window.removeEventListener('beforeinstallprompt', onInstallPrompt)
      window.removeEventListener('orientationchange', lockPortrait)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('online', update)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(updateTimer)
    }
  }, [])
  return null
}
