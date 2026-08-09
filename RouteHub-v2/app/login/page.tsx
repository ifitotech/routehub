'use client'

import Image from 'next/image'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {resolveAccess, workspaceForStrictRole} from '../auth-access'

const slides = [
  {name: 'Driver', text: 'Live routes, navigation and proof of delivery.'},
  {name: 'Manager', text: 'Dispatch teams, organize routes and respond quickly.'},
]

type DialogMode = 'sign-in' | 'request' | null

function accessMessage(code: string) {
  if (code === 'ROLE_NOT_ASSIGNED') return 'This account has no company role assigned.'
  if (code === 'MULTIPLE_ROLES') return 'This account has multiple roles assigned. Contact an administrator.'
  if (code === 'TRIAL_EXPIRED') return 'Your 7-day trial has ended. Contact RouteHub to continue.'
  return 'Unable to verify your account access.'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [slide, setSlide] = useState(0)
  const [dialog, setDialog] = useState<DialogMode>(null)

  useEffect(() => {
    if (dialog) return
    const timer = window.setInterval(() => setSlide(value => (value + 1) % slides.length), 3200)
    return () => window.clearInterval(timer)
  }, [dialog])

  useEffect(() => {
    const storedError = sessionStorage.getItem('routehub_auth_error')
    if (storedError) {
      sessionStorage.removeItem('routehub_auth_error')
      setMessage(accessMessage(storedError))
      setDialog('sign-in')
    }
    resolveAccess(getSupabase())
      .then(access => window.location.replace(workspaceForStrictRole(access.role)))
      .catch(() => {})
  }, [])

  const closeDialog = () => {
    if (busy) return
    setDialog(null)
    setMessage('')
  }

  const signIn = async () => {
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
      setMessage(raw.startsWith('ROLE_') || raw === 'MULTIPLE_ROLES' || raw === 'TRIAL_EXPIRED' ? accessMessage(raw) : raw)
    } finally {
      setBusy(false)
    }
  }

  const requestAccess = async () => {
    if (!fullName.trim() || !companyName.trim() || !email.trim() || password.length < 8 || busy) return
    setBusy(true)
    setMessage('Creating your 7-day trial…')
    try {
      const client = getSupabase()
      await client.auth.signOut()
      const {data, error} = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {data: {full_name: fullName.trim(), company_name: companyName.trim(), phone: phone.trim()}},
      })
      if (error) throw error
      if (!data.session) {
        setMessage('Your account was created. Check your email to confirm it, then sign in to start your trial.')
        return
      }
      const {error: workspaceError} = await client.rpc('create_trial_workspace', {
        requester_name: fullName.trim(),
        requester_company: companyName.trim(),
        requester_phone: phone.trim() || null,
      })
      if (workspaceError) throw workspaceError
      const access = await resolveAccess(client)
      window.location.replace(workspaceForStrictRole(access.role))
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Unable to create your trial.'
      setMessage(raw.includes('already registered') ? 'This email already has an account. Sign in instead.' : raw)
    } finally {
      setBusy(false)
    }
  }

  const current = slides[slide]
  return <main className="landing">
    <header className="landing-nav"><Image src="/routehub-logo-alpha.png" alt="RouteHub" width={1012} height={890} priority/><button className="secondary" onClick={() => { setMessage(''); setDialog('sign-in') }}>Sign in</button></header>
    <section className="hero"><div className="hero-copy"><span className="eyebrow">ROUTE OPERATIONS, SIMPLIFIED</span><h1>Deliver more.<br/><em>Stress less.</em></h1><p>One clear workspace for every route, every driver and every delivery.</p><button className="primary hero-cta" onClick={() => { setMessage(''); setDialog('request') }}>Request access <span>→</span></button><div className="trust"><span>Start a 7-day premium trial</span><span>No waiting for approval</span></div></div><div className="hero-visual"><Image src="/login-hero.png" alt="RouteHub driver and manager workspaces" width={1200} height={800} priority/><div className="floating-card"><strong>{current.name}</strong><span>{current.text}</span></div></div></section>
    <section className="feature-row"><article><b>01</b><h3>Plan clearly</h3><p>Turn every pickup and delivery into a simple route.</p></article><article><b>02</b><h3>Move together</h3><p>Keep dispatchers and drivers aligned in real time.</p></article><article><b>03</b><h3>Stay accountable</h3><p>Capture completion, photos and problems in one place.</p></article></section>
    {dialog && <div className="modal-backdrop"><section className="card modal login-card" aria-labelledby="access-dialog-title"><button className="close" aria-label="Close" onClick={closeDialog}>×</button><Image src="/routehub-logo-alpha.png" alt="RouteHub" className="login-logo" width={1012} height={890}/>
      {dialog === 'sign-in' ? <><h2 id="access-dialog-title">Welcome back</h2><p className="muted">Use your RouteHub email and password.</p><label>Email<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => {if (event.key === 'Enter') void signIn()}}/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => {if (event.key === 'Enter') void signIn()}}/></label><button className="primary" disabled={busy || !email || !password} onClick={signIn}>{busy ? 'Signing in…' : 'Sign in'}</button><button className="text-button" disabled={busy} onClick={() => { setMessage(''); setDialog('request') }}>New to RouteHub? Start a 7-day trial</button></> : <><span className="trial-kicker">7-DAY PREMIUM TRIAL</span><h2 id="access-dialog-title">Start your workspace</h2><p className="muted">Your request will appear in RouteHub Admin. You can begin using the app right away.</p><label>Your name<input autoComplete="name" placeholder="Your full name" value={fullName} onChange={event => setFullName(event.target.value)}/></label><label>Company name<input autoComplete="organization" placeholder="Your company" value={companyName} onChange={event => setCompanyName(event.target.value)}/></label><label>Email<input type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={event => setEmail(event.target.value)}/></label><label>Phone number <span className="optional">Optional</span><input type="tel" autoComplete="tel" placeholder="(555) 555-5555" value={phone} onChange={event => setPhone(event.target.value)}/></label><label>Create password<input type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => {if (event.key === 'Enter') void requestAccess()}}/></label><button className="primary" disabled={busy || !fullName.trim() || !companyName.trim() || !email.trim() || password.length < 8} onClick={requestAccess}>{busy ? 'Creating trial…' : 'Start 7-day trial'}</button><button className="text-button" disabled={busy} onClick={() => { setMessage(''); setDialog('sign-in') }}>I already have an account</button></>}
      {message && <p className="login-message" role="status" aria-live="polite">{message}</p>}
    </section></div>}
  </main>
}
