'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {usePathname} from 'next/navigation'
import {FileText, ShieldCheck} from 'lucide-react'
import {getSupabase} from '../lib/supabase'
import {useLocale} from '../lib/use-preferences'
import {acceptTerms, hasAcceptedTerms, TERMS_VERSION} from '../lib/terms'
import styles from './terms-gate.module.css'

const PUBLIC_PATHS = ['/', '/login', '/auth/callback', '/activate-invitation', '/product', '/how-it-works', '/for-drivers', '/terms']

export default function TermsGate() {
  const pathname = usePathname()
  const {locale} = useLocale()
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState(false)

  const copy = locale === 'es'
    ? {title:'Términos de uso de RouteHub',intro:'Antes de continuar, revisa y acepta los términos de uso de RouteHub.',consent:'Acepto los Términos de uso y entiendo cómo se utilizan los datos de rutas, ubicación y comprobantes en la aplicación.',read:'Leer términos completos',continue:'Aceptar y continuar',version:`Versión ${TERMS_VERSION}`}
    : locale === 'fr'
      ? {title:'Conditions d’utilisation RouteHub',intro:'Avant de continuer, consultez et acceptez les conditions d’utilisation de RouteHub.',consent:'J’accepte les conditions d’utilisation et je comprends comment les itinéraires, la position et les preuves sont utilisés dans l’application.',read:'Lire les conditions complètes',continue:'Accepter et continuer',version:`Version ${TERMS_VERSION}`}
      : {title:'RouteHub Terms of Use',intro:'Before continuing, please review and accept the RouteHub Terms of Use.',consent:'I accept the Terms of Use and understand how route, location and proof data are used in the application.',read:'Read the full terms',continue:'Accept and continue',version:`Version ${TERMS_VERSION}`}

  useEffect(() => {
    if (PUBLIC_PATHS.some(path => pathname === path || (path !== '/' && pathname.startsWith(path)))) {
      setOpen(false)
      return
    }
    let active = true
    const sync = async () => {
      try {
        const {data} = await getSupabase().auth.getUser()
        const id = data.user?.id
        if (!active || !id) return
        setUserId(id)
        setOpen(!hasAcceptedTerms(id))
      } catch {
        // AuthBoundary owns authentication and redirects. Terms must never
        // turn a transient auth/network error into a blank workspace.
      }
    }
    void sync()
    const {data: listener} = getSupabase().auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { setUserId(null); setOpen(false) }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') void sync()
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  const isPublicPath = PUBLIC_PATHS.some(path => pathname === path || (path !== '/' && pathname.startsWith(path)))
  if (isPublicPath || !open || !userId) return null
  return <div className={styles.backdrop} role="presentation">
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="routehub-terms-title">
      <header className={styles.header}><div className={styles.icon}><ShieldCheck size={24}/></div><h2 id="routehub-terms-title">{copy.title}</h2></header>
      <div className={styles.content}><p>{copy.intro}</p><p><strong>RouteHub</strong> helps your company plan routes, coordinate drivers and keep delivery or pickup records organized.</p><p><Link className={styles.link} href="/terms">{copy.read} <FileText size={14} aria-hidden="true" style={{verticalAlign:'-2px'}}/></Link></p><label className={styles.consent}><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/><span>{copy.consent}</span></label></div>
      <div className={styles.footer}><button className={styles.button} type="button" disabled={!checked} onClick={() => { acceptTerms(userId); setOpen(false) }}>{copy.continue}</button></div>
      <div className={styles.version}>{copy.version}</div>
    </section>
  </div>
}
