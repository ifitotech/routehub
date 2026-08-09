'use client'

import {useEffect} from 'react'
import {useRouter} from 'next/navigation'
import {getSupabase} from '../lib/supabase'
import {resolveAccess, workspaceForStrictRole} from './auth-access'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    resolveAccess(getSupabase())
      .then(access => router.replace(workspaceForStrictRole(access.role)))
      .catch(() => router.replace('/login'))
  }, [router])
  return <main className="app"><section className="card" style={{marginTop: 72, textAlign: 'center'}}><h1>RouteHub</h1><p className="muted">Opening your role dashboard…</p></section></main>
}
