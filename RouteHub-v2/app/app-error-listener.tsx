'use client'

import {useEffect} from 'react'
import {reportAppError} from '../lib/error-reporting'

// reportAppError() already existed (dedup, PII redaction, runtime context)
// but nothing ever called it outside one narrow Driver completion edge
// case - every other uncaught error just vanished into the browser console
// with nobody the wiser. These two listeners catch anything that reaches
// the window uncaught, so it shows up in Admin > Errors instead.
export default function AppErrorListener() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event.error instanceof Error ? event.error.message : String(event.message || '')
      // These are browser/framework control signals, not actionable RouteHub
      // failures. Reporting them made the pilot error inbox look broken and
      // hid the real workflow errors underneath hundreds of duplicates.
      if (message === 'NEXT_REDIRECT' || message === 'Script error.' || message.startsWith('ResizeObserver loop')) return
      void reportAppError({action: 'uncaught_error', error: event.error || event.message, context: {kind: 'window.onerror', filename: event.filename, lineno: event.lineno, colno: event.colno}})
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason?.message || event.reason || '')
      if (message === 'NEXT_REDIRECT') return
      void reportAppError({action: 'unhandled_rejection', error: event.reason, context: {kind: 'unhandledrejection'}})
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
