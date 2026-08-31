'use client'

import {useEffect, useState} from 'react'
import {usePathname, useRouter} from 'next/navigation'
import {getSupabase} from '../../lib/supabase'

/**
 * Auth gate for Driver workspaces (V2 /driver and V3 /driver-v3).
 * Shows an app-style splash instead of a website card while session resolves.
 */
export default function DriverSessionGate({children}: {children: React.ReactNode}) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const isV3 = pathname?.startsWith('/driver-v3')

  useEffect(() => {
    let cancelled = false
    getSupabase()
      .auth.getSession()
      .then(({data}) => {
        if (cancelled) return
        if (!data.session) {
          router.replace('/login')
          return
        }
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) router.replace('/login')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  if (!ready) {
    if (isV3) {
      return (
        <div className="driver-v3-splash" role="status" aria-live="polite">
          <img src="/routehub-driver-app.jpg" alt="" width={72} height={72} />
          <strong>RouteHub Driver</strong>
          <p>Opening your workspace…</p>
          <div className="spin" aria-hidden="true" />
        </div>
      )
    }
    return (
      <main className="app">
        <div className="card">
          <p className="muted">Loading secure workspace...</p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
