'use client'

import {useEffect} from 'react'

export default function PwaRegister() {
  useEffect(() => {
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
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('online', update)
      window.removeEventListener('focus', update)
    }
  }, [])
  return null
}
