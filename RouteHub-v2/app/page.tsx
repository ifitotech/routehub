'use client'

import {useEffect} from 'react'
import LoginPage from './login/page'
import {getSupabase} from '../lib/supabase'
import {resolveAccess, workspaceForStrictRole} from './auth-access'

export default function Home() {
  useEffect(() => {
    let active = true
    void getSupabase().auth.getSession().then(async ({data}) => {
      if (!data.session) return
      try { const access = await resolveAccess(getSupabase()); if (active) window.location.replace(workspaceForStrictRole(access.role)) } catch {}
    })
    return () => { active = false }
  }, [])
  return <LoginPage />
}
