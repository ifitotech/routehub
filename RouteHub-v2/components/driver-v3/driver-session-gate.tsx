'use client'

import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'

/**
 * Auth gate for the Driver V3 workspace.
 * Shows an app-style splash instead of a website card while session resolves.
 */
export default function DriverSessionGate({children}: {children: React.ReactNode}) {
  const router = useRouter()
  const {locale} = useLocale()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let decided = false
    const client = getSupabase()
    // A persisted Supabase session is available immediately on most warm and
    // installed-PWA launches. Render the workspace without waiting for the
    // auth event so the splash is not shown on every open.
    void client.auth.getSession().then(({data}) => {
      if (cancelled || decided) return
      if (data.session) { decided = true; setReady(true) }
    }).catch(() => {})
    // A bare getSession() call right on mount can race a cold PWA launch:
    // Supabase hasn't necessarily finished rehydrating the persisted session
    // from storage yet, so it can resolve with no session even though a
    // valid one exists - which was bouncing every cold launch through
    // /login (where a second, later check found the real session) before
    // landing back on /driver. onAuthStateChange's first callback reflects
    // the session Supabase actually resolved after checking storage, so
    // waiting for that instead removes the false negative. A timeout
    // fallback still redirects if the auth client genuinely never resolves,
    // so a real failure doesn't strand the splash forever.
    const {data: {subscription}} = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled || decided) return
      decided = true
      if (!session) { router.replace('/login'); return }
      setReady(true)
    })
    const timeout = window.setTimeout(() => {
      if (cancelled || decided) return
      decided = true
      router.replace('/login')
    }, 8000)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [router])

  if (!ready) {
    return (
      <div className="driver-v3-splash" role="status" aria-live="polite">
        <img className="driver-v3-splash-hero" src="/driver-empty-route-hero.png" alt="" />
        <img src="/routehub-driver-new.jpg" alt="" width={72} height={72} />
        <strong>RouteHub Driver</strong>
        <p>{locale === 'es' ? 'Abriendo tu espacio de trabajo…' : locale === 'fr' ? 'Ouverture de votre espace de travail…' : 'Opening your workspace…'}</p>
        <div className="spin" aria-hidden="true" />
      </div>
    )
  }

  return <>{children}</>
}
