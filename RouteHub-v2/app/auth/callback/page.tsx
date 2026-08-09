'use client'

import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import {resolveAccess, workspaceForStrictRole} from '../../auth-access'

export default function Callback() {
  const [message, setMessage] = useState('Verifying your session…')
  useEffect(() => {
    void (async () => {
      try {
        const client = getSupabase()
        const code = new URLSearchParams(window.location.search).get('code')
        if (code) {
          const {error} = await client.auth.exchangeCodeForSession(code)
          if (error) throw error
        }
        const access = await resolveAccess(client)
        window.location.replace(workspaceForStrictRole(access.role))
      } catch (error) {
        const value = error instanceof Error ? error.message : 'Unable to verify the session.'
        sessionStorage.setItem('routehub_auth_error', value)
        setMessage('Unable to verify your account. Returning to sign in…')
        window.setTimeout(() => window.location.replace('/login'), 1200)
      }
    })()
  }, [])
  return <main className="app"><section className="card" style={{maxWidth: 520, margin: '80px auto', textAlign: 'center'}}><h1>RouteHub</h1><p className="muted" role="status">{message}</p></section></main>
}
