'use client'

import {useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {resolveAccess, workspaceForStrictRole} from '../auth-access'

export default function ActivateInvitationPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const activate = async () => {
    if (busy) return
    if (password.length < 8) { setMessage('Use at least 8 characters for your password.'); return }
    if (password !== confirmPassword) { setMessage('Your passwords do not match.'); return }
    setBusy(true); setMessage('')
    try {
      const client = getSupabase()
      const result = await client.functions.invoke('send-manager-invite', {body: {action: 'activate', email: email.trim().toLowerCase(), code: code.trim(), password}})
      let detail = result.error?.message || ''
      if (result.error && 'context' in result.error) { try { detail = ((await (result.error as {context: Response}).context.json()) as {error?: string}).error || detail } catch {} }
      if (result.error) throw new Error(detail)
      const {error} = await client.auth.signInWithPassword({email: email.trim().toLowerCase(), password})
      if (error) throw error
      const access = await resolveAccess(client)
      window.location.replace(workspaceForStrictRole(access.role))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not activate the account.') }
    finally { setBusy(false) }
  }
  return <main className="app"><section className="card" style={{maxWidth: 500, margin: 'max(42px, 8dvh) auto', padding: 'clamp(24px, 5vw, 42px)'}}><p className="eyebrow">RouteHub invitation</p><h1 style={{marginTop: 0}}>Set up your account</h1><p className="muted">Enter the one-time code from your manager, then create your password.</p><div style={{display: 'grid', gap: 14, marginTop: 24}}><label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com"/></label><label>Activation code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} placeholder="6-digit code"/></label><label>New password<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters"/></label><label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Enter it again" onKeyDown={event => { if (event.key === 'Enter') void activate() }}/></label><button className="primary" disabled={busy || !email || code.length !== 6 || !password || !confirmPassword} onClick={() => void activate()}>{busy ? 'Activating…' : 'Activate account'}</button>{message && <p className="muted" role="status">{message}</p>}</div></section></main>
}
