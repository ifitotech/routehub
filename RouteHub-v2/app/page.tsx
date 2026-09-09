'use client'

import {useEffect, useState} from 'react'
import LoginPage from './login/page'
import {getSupabase} from '../lib/supabase'
import {resolveAccess, workspaceForStrictRole} from './auth-access'

export default function Home() {
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true
    void getSupabase().auth.getSession().then(async ({data}) => {
      if (!data.session) {
        if (active) setCheckingSession(false)
        return
      }
      try { const access = await resolveAccess(getSupabase()); if (active) window.location.replace(workspaceForStrictRole(access.role)) } catch {}
      // Keep the splash visible while the browser follows the workspace redirect.
    })
    return () => { active = false }
  }, [])
  if (checkingSession) {
    return (
      <main className="app">
        <section className="card" style={{marginTop: 72, textAlign: 'center'}} role="status" aria-live="polite">
          <img src="/routehub-driver-new.jpg" alt="" width={72} height={72} />
          <h1>RouteHub</h1>
          <p className="muted">Opening your workspace…</p>
          <div className="spin" aria-hidden="true" />
        </section>
      </main>
    )
  }
  return <LoginPage />
}
