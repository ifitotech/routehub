'use client'

import Image from 'next/image'
import Link from 'next/link'
import {ArrowRight, CheckCircle2, MapPin, Menu, Plus, ShieldCheck, Users, X, Zap} from 'lucide-react'
import type {LucideIcon} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {resolveAccess, workspaceForStrictRole} from '../auth-access'
import styles from './landing.module.css'
import InstallAppCard from '../install-app-card'

type DialogMode = 'sign-in' | 'request' | null
type Step = {Icon: LucideIcon; title: string; copy: string}
const steps: Step[] = [
  {Icon: Plus, title: 'CREATE', copy: 'Build pickup and delivery work quickly.'},
  {Icon: Users, title: 'ASSIGN', copy: 'Send the work to the right driver.'},
  {Icon: MapPin, title: 'TRACK', copy: 'See operational progress and current location.'},
  {Icon: CheckCircle2, title: 'COMPLETE', copy: 'Capture completion, photos, signatures and notes.'},
]

function accessMessage(code: string) {
  if (code === 'ROLE_NOT_ASSIGNED') return 'This account has no company role assigned.'
  if (code === 'MULTIPLE_ROLES') return 'This account has multiple roles assigned. Contact an administrator.'
  if (code === 'TRIAL_EXPIRED') return 'Your 7-day trial has ended. Contact RouteHub to continue.'
  return 'Unable to verify your account access.'
}

function WorkflowPreview() {
  const flow = [
    {Icon: Plus, label: 'Create', detail: 'Pickup or delivery'},
    {Icon: Users, label: 'Assign', detail: 'Right driver'},
    {Icon: MapPin, label: 'Track', detail: 'Live operation'},
    {Icon: ShieldCheck, label: 'Complete', detail: 'Proof captured'},
  ]
  return <div className={styles.workflowPreview} aria-label="RouteHub pickup and delivery operations workflow">
    <div className={styles.workflowHeader}><div><span>ROUTEHUB OPERATIONS</span><h3>One connected workflow</h3></div><span className={styles.workflowPill}><i/>Ready</span></div>
    <div className={styles.workflowSteps}>{flow.map(({Icon, label, detail}, index) => <div className={styles.workflowStep} key={label}><span className={styles.workflowIcon}><Icon size={18}/></span><div><strong>{label}</strong><small>{detail}</small></div>{index < flow.length - 1 && <span className={styles.workflowLine}/>}</div>)}</div>
    <div className={styles.workflowProof}><span className={styles.workflowProofIcon}><CheckCircle2 size={18}/></span><div><strong>Proof of delivery</strong><small>Photos, signatures and notes stay with the completed work.</small></div></div>
  </div>
}

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [fullName, setFullName] = useState(''); const [companyName, setCompanyName] = useState(''); const [phone, setPhone] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [dialog, setDialog] = useState<DialogMode>(null); const [menu, setMenu] = useState(false); const [workspaceHref, setWorkspaceHref] = useState<string | null>(null); const [checkingPwaSession, setCheckingPwaSession] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('source') === 'pwa')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const tokenType = params.get('type')
    if (tokenHash && (tokenType === 'invite' || tokenType === 'recovery')) {
      setCheckingPwaSession(false)
      void getSupabase().auth.verifyOtp({token_hash: tokenHash, type: tokenType as 'invite' | 'recovery'}).then(({error}) => {
        if (error) setMessage(error.message)
        else { window.location.hash = `type=${tokenType}`; setDialog('sign-in'); setMessage(tokenType === 'invite' ? 'You have been invited to RouteHub. Create a password to accept the invitation.' : 'Create a new password to continue.') }
      })
      return
    }
    if (window.location.hash.includes('type=recovery')) { setCheckingPwaSession(false); setDialog('sign-in'); setMessage('Create a new password to continue.'); return }
    if (window.location.hash.includes('type=invite')) { setCheckingPwaSession(false); setDialog('sign-in'); setMessage('You have been invited to RouteHub. Create a password to accept the invitation.'); return }
    const storedError = sessionStorage.getItem('routehub_auth_error')
    if (storedError) { sessionStorage.removeItem('routehub_auth_error'); setCheckingPwaSession(false); setMessage(accessMessage(storedError)); setDialog('sign-in') }
    const client = getSupabase()
    client.auth.getSession().then(({data}) => {
      if (!data.session) { setCheckingPwaSession(false); return null }
      return resolveAccess(client)
    }).then(access => {
      if (!access) return
      if (access.user) {
        window.location.replace(workspaceForStrictRole(access.role))
        return
      }
      setWorkspaceHref(null)
    }).catch(error => {
      setCheckingPwaSession(false)
      setMessage(accessMessage(error instanceof Error ? error.message : ''))
      setDialog('sign-in')
    })
  }, [])
  useEffect(() => { if (dialog !== 'sign-in' || !window.location.hash.includes('type=recovery')) return; const input = document.querySelector<HTMLInputElement>('input[autocomplete="current-password"]'); const submit = document.querySelector<HTMLButtonElement>('.modalPrimary'); if (!input || !submit || submit.dataset.recoveryReady) return; input.autocomplete = 'new-password'; input.placeholder = 'New password (8+ characters)'; submit.dataset.recoveryReady = 'true'; submit.textContent = 'Update password'; submit.onclick = async () => { if (input.value.length < 8) { setMessage('Use at least 8 characters.'); return }; setBusy(true); const {error} = await getSupabase().auth.updateUser({password: input.value}); setMessage(error?.message || 'Password updated. You can now sign in.'); setBusy(false); if (!error) { window.history.replaceState({}, '', '/login'); setDialog(null) } } }, [dialog])
  useEffect(() => {
    if (dialog !== 'sign-in' || !window.location.hash.includes('type=invite')) return
    const input = document.querySelector<HTMLInputElement>('input[autocomplete="current-password"]')
    const submit = document.querySelector<HTMLButtonElement>('.modalPrimary')
    if (!input || !submit || submit.dataset.inviteReady) return
    input.autocomplete = 'new-password'
    input.placeholder = 'Create password (8+ characters)'
    submit.dataset.inviteReady = 'true'
    submit.textContent = 'Accept invitation'
    submit.onclick = async () => {
      if (input.value.length < 8) { setMessage('Use at least 8 characters.'); return }
      setBusy(true)
      try {
        const client = getSupabase()
        const {error} = await client.auth.updateUser({password: input.value})
        if (error) throw error
        const access = await resolveAccess(client)
        window.history.replaceState({}, '', '/login')
        window.location.replace(workspaceForStrictRole(access.role))
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not accept the invitation.')
      } finally { setBusy(false) }
    }
  }, [dialog])
  const open = (mode: DialogMode) => { setMessage(''); setDialog(mode); setMenu(false) }
  const closeDialog = () => { if (!busy) { setDialog(null); setMessage('') } }
  useEffect(() => { if (dialog !== 'sign-in') return; const passwordInput = document.querySelector<HTMLInputElement>('input[autocomplete="current-password"]'); if (!passwordInput || passwordInput.parentElement?.querySelector('[data-reset-password]')) return; const link = document.createElement('button'); link.type = 'button'; link.dataset.resetPassword = 'true'; link.textContent = 'Forgot password?'; link.style.cssText = 'display:block;margin:10px 0 0 auto;border:0;background:transparent;color:#2563eb;font:inherit;font-size:13px;font-weight:800;cursor:pointer'; link.onclick = async () => { const address = document.querySelector<HTMLInputElement>('input[autocomplete="username"]')?.value.trim().toLowerCase(); if (!address) { setMessage('Enter your email first.'); return }; setBusy(true); setMessage('Sending password reset email…'); const {error} = await getSupabase().auth.resetPasswordForEmail(address, {redirectTo: 'https://routehub-wisu.vercel.app/login'}); setMessage(error?.message || 'Check your email for a secure password reset link.'); setBusy(false) }; passwordInput.parentElement?.appendChild(link); return () => link.remove() }, [dialog])
  const signIn = async () => { if (!email || !password || busy) return; setBusy(true); setMessage('Signing in…'); try { const client = getSupabase(); await client.auth.signOut(); const {error} = await client.auth.signInWithPassword({email: email.trim().toLowerCase(), password}); if (error) throw error; const access = await resolveAccess(client); window.location.replace(workspaceForStrictRole(access.role)) } catch (error) { const raw = error instanceof Error ? error.message : 'Unable to sign in.'; setMessage(raw.startsWith('ROLE_') || raw === 'MULTIPLE_ROLES' || raw === 'TRIAL_EXPIRED' ? accessMessage(raw) : raw) } finally { setBusy(false) } }
  const requestAccess = async () => { if (!fullName.trim() || !companyName.trim() || !email.trim() || password.length < 8 || busy) return; setBusy(true); setMessage('Creating your workspace…'); try { const client = getSupabase(); await client.auth.signOut(); const {data, error} = await client.auth.signUp({email: email.trim().toLowerCase(), password, options: {data: {full_name: fullName.trim(), company_name: companyName.trim(), phone: phone.trim()}}}); if (error) throw error; if (!data.session) { setMessage('Your account was created. Check your email to confirm it, then sign in.'); return }; const {error: workspaceError} = await client.rpc('create_trial_workspace', {requester_name: fullName.trim(), requester_company: companyName.trim(), requester_phone: phone.trim() || null}); if (workspaceError) throw workspaceError; const access = await resolveAccess(client); window.location.replace(workspaceForStrictRole(access.role)) } catch (error) { const raw = error instanceof Error ? error.message : 'Unable to create your workspace.'; setMessage(raw.includes('already registered') ? 'This email already has an account. Sign in instead.' : raw) } finally { setBusy(false) } }
  if (checkingPwaSession) return <main className={styles.landing}><section className={styles.hero}><div className={styles.heroCopy}><p className={styles.badge}><i/> RouteHub</p><h1>Opening your workspace…</h1><p className={styles.subtitle}>Restoring your secure RouteHub session.</p></div></section></main>
  const primaryAction = workspaceHref ? <Link className={styles.primaryButton} href={workspaceHref}>Open RouteHub <ArrowRight size={18}/></Link> : <button className={styles.primaryButton} onClick={() => open('request')}>Get Started <ArrowRight size={18}/></button>
  return <main className={styles.landing}>
    <header className={styles.header}><Link href="/" className={styles.wordmark}><Image src="/routehub-regular-new.jpg" alt="RouteHub" width={64} height={64} priority/><span>Route<em>Hub</em></span></Link><button className={styles.menuButton} onClick={() => setMenu(!menu)} aria-label="Open navigation" aria-expanded={menu}>{menu ? <X/> : <Menu/>}</button><nav className={menu ? `${styles.nav} ${styles.navOpen}` : styles.nav}><a href="#product" onClick={() => setMenu(false)}>Product</a><a href="#how-it-works" onClick={() => setMenu(false)}>How it works</a><div className={styles.mobileActions}>{workspaceHref ? <Link href={workspaceHref}>Open RouteHub</Link> : <><button onClick={() => open('sign-in')}>Sign in</button><button className={styles.mobilePrimary} onClick={() => open('request')}>Get Started</button></>}</div></nav><div className={styles.headerActions}>{workspaceHref ? <Link className={styles.signIn} href={workspaceHref}>Open RouteHub</Link> : <button className={styles.signIn} onClick={() => open('sign-in')}>Sign in</button>}{primaryAction}</div></header>
    <section className={styles.hero} id="product"><div className={styles.heroCopy}><p className={styles.badge}><i/> Pickup &amp; delivery operations</p><h1>Run pickups and deliveries faster.</h1><p className={styles.subtitle}>Create, assign, track and complete pickups and deliveries with less friction and more visibility.</p><div className={styles.heroActions}>{primaryAction}<button type="button" className={styles.secondaryButton} onClick={() => open('sign-in')}>Sign In <ArrowRight size={17}/></button></div><div className={styles.heroBenefits}><article><Zap/><div><b>Faster operations</b><span>Create and organize work with fewer steps.</span></div></article><article><MapPin/><div><b>Real-time visibility</b><span>See active work and current driver location.</span></div></article><article><ShieldCheck/><div><b>Proof of delivery</b><span>Keep photos, signatures and notes together.</span></div></article></div></div><div className={styles.previewWrap}><WorkflowPreview/></div></section>
    <section className={styles.positioningMessage}><p className={styles.sectionEyebrow}>THE OPERATION AROUND THE ROUTE</p><h2>There are plenty of navigation apps.<br/>You already know the one that works.<br/><em>RouteHub handles everything else.</em></h2><p>RouteHub keeps dispatch, drivers and proof of delivery connected from the first assignment to the completed job.</p></section>
    <section className={styles.how} id="how-it-works"><p className={styles.sectionEyebrow}>A SIMPLE OPERATIONAL FLOW</p><h2>Create. Assign. Track. Complete.</h2><p>Everything your team needs to move pickup and delivery work forward.</p><div className={styles.steps}>{steps.map(({Icon, title, copy}) => <article key={title}><i><Icon size={24}/></i><b>{title}</b><span>{copy}</span></article>)}</div></section>
    <section className={styles.features} aria-label="RouteHub benefits"><article><i><Zap/></i><div><b>Faster Operations</b><p>Create and organize pickups and deliveries with fewer steps.</p></div><CheckCircle2/></article><article><i><MapPin/></i><div><b>Real-Time Visibility</b><p>See active operations, route progress and current driver location.</p></div><CheckCircle2/></article><article><i><ShieldCheck/></i><div><b>Proof of Delivery</b><p>Keep photos, signatures, notes and completion records together.</p></div><CheckCircle2/></article></section>
    <InstallAppCard/>
    <footer className={styles.footer}><span>© {new Date().getFullYear()} RouteHub</span><span style={{display:'inline-flex',alignItems:'center',gap:18}}><Link href="/terms" style={{color:'var(--blue)',fontWeight:800,textDecoration:'none'}}>Terms of Use</Link><button onClick={() => open('sign-in')}>Sign in</button></span></footer>
    {dialog && <div className={styles.modalBackdrop} role="presentation"><section className={styles.modal} aria-modal="true" role="dialog" aria-labelledby="access-dialog-title"><button className={styles.close} aria-label="Close" onClick={closeDialog}>×</button><Image src="/routehub-regular-new.jpg" alt="RouteHub" width={58} height={58}/>{dialog === 'sign-in' ? <><h2 id="access-dialog-title">Welcome back</h2><p>Sign in to manage your pickup and delivery operations.</p><label>Email<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void signIn() }}/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void signIn() }}/></label><button className={styles.modalPrimary} disabled={busy || !email || !password} onClick={signIn}>{busy ? 'Signing in…' : 'Sign in'}</button><button className={styles.textButton} onClick={() => open('request')} disabled={busy}>New to RouteHub? Get started</button></> : <><h2 id="access-dialog-title">Start your workspace</h2><p>Tell us a little about your team to start using RouteHub.</p><label>Your name<input autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)}/></label><label>Company name<input autoComplete="organization" value={companyName} onChange={event => setCompanyName(event.target.value)}/></label><label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)}/></label><label>Phone number <small>Optional</small><input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)}/></label><label>Create password<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void requestAccess() }}/></label><button className={styles.modalPrimary} disabled={busy || !fullName.trim() || !companyName.trim() || !email.trim() || password.length < 8} onClick={requestAccess}>{busy ? 'Creating workspace…' : 'Start 7-day trial'}</button><button className={styles.textButton} onClick={() => open('sign-in')} disabled={busy}>I already have an account</button></>}{message && <p className={styles.message} role="status">{message}</p>}</section></div>}
  </main>
}
