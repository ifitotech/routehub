'use client'

import Image from 'next/image'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {resolveAccess, workspaceForStrictRole} from '../auth-access'

const slides = [
  {name: 'Driver', text: 'Live routes, navigation and proof of delivery.'},
  {name: 'Manager', text: 'Dispatch teams, organize routes and respond quickly.'},
]

function accessMessage(code: string) {
  if (code === 'ROLE_NOT_ASSIGNED') return 'This account has no company role assigned.'
  if (code === 'MULTIPLE_ROLES') return 'This account has multiple roles assigned. Contact an administrator.'
  return 'Unable to verify your account access.'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [slide, setSlide] = useState(0)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    if (showLogin) return
    const timer = window.setInterval(() => setSlide(value => (value + 1) % slides.length), 3200)
    return () => window.clearInterval(timer)
  }, [showLogin])

  useEffect(() => {
    const storedError = sessionStorage.getItem('routehub_auth_error')
    if (storedError) {
      sessionStorage.removeItem('routehub_auth_error')
      setMessage(accessMessage(storedError))
      setShowLogin(true)
    }
    resolveAccess(getSupabase())
      .then(access => window.location.replace(workspaceForStrictRole(access.role)))
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!email || !password || busy) return
    setBusy(true)
    setMessage('Signing in…')
    try {
      const client = getSupabase()
      await client.auth.signOut()
      const {error} = await client.auth.signInWithPassword({email: email.trim().toLowerCase(), password})
      if (error) throw error
      const access = await resolveAccess(client)
      window.location.replace(workspaceForStrictRole(access.role))
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Unable to sign in.'
      setMessage(raw.startsWith('ROLE_') || raw === 'MULTIPLE_ROLES' ? accessMessage(raw) : raw)
    } finally {
      setBusy(false)
    }
  }

  const current = slides[slide]
  return <main className="landing">
    <header className="landing-nav"><Image src="/routehub-logo-alpha.png" alt="RouteHub" width={1012} height={890} priority/><button className="secondary" onClick={() => setShowLogin(true)}>Sign in</button></header>
    <section className="hero"><div className="hero-copy"><span className="eyebrow">ROUTE OPERATIONS, SIMPLIFIED</span><h1>Deliver more.<br/><em>Stress less.</em></h1><p>One clear workspace for every route, every driver and every delivery.</p><button className="primary hero-cta" onClick={() => setShowLogin(true)}>Start with RouteHub <span>→</span></button><div className="trust"><span>Built for daily operations</span><span>Designed for real teams</span></div></div><div className="hero-visual"><Image src="/login-hero.png" alt="RouteHub driver and manager workspaces" width={1200} height={800} priority/><div className="floating-card"><strong>{current.name}</strong><span>{current.text}</span></div></div></section>
    <section className="feature-row"><article><b>01</b><h3>Plan clearly</h3><p>Turn every pickup and delivery into a simple route.</p></article><article><b>02</b><h3>Move together</h3><p>Keep dispatchers and drivers aligned in real time.</p></article><article><b>03</b><h3>Stay accountable</h3><p>Capture completion, photos and problems in one place.</p></article></section>
    {showLogin && <div className="modal-backdrop"><section className="card modal login-card"><button className="close" aria-label="Close" onClick={() => setShowLogin(false)}>×</button><Image src="/routehub-logo-alpha.png" alt="RouteHub" className="login-logo" width={1012} height={890}/><h2>Welcome back</h2><p className="muted">Use your invited RouteHub account.</p><label>Email<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => {if (event.key === 'Enter') void submit()}}/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => {if (event.key === 'Enter') void submit()}}/></label><button className="primary" disabled={busy || !email || !password} onClick={submit}>{busy ? 'Signing in…' : 'Sign in'}</button>{message && <p className="muted" role="status">{message}</p>}</section></div>}
  </main>
}
