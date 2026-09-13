'use client'

import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {getSupabase} from '../../lib/supabase'

/**
 * Auth gate for the Driver V3 workspace.
 * Shows an app-style splash instead of a website card while session resolves.
 */
export default function DriverSessionGate({children}: {children: React.ReactNode}) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

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
    return (
      <div className="driver-v3-splash" role="status" aria-live="polite">
        <img src="/routehub-driver-new.jpg" alt="" width={72} height={72} />
        <strong>RouteHub Driver</strong>
        <p>Opening your workspace…</p>
        <div className="spin" aria-hidden="true" />
      </div>
    )
  }

  return <>{children}</>
}
