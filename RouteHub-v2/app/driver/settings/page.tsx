'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '../../../lib/supabase'
import { getLocale, translations, type Locale } from '../../../lib/i18n'

export default function DriverSettings() {
  const router = useRouter()
  const [theme, setTheme] = useState('system')
  const [language, setLanguage] = useState<Locale>('en')
  const [email, setEmail] = useState('')
  const t = translations[language]

  useEffect(() => {
    setTheme(localStorage.getItem('routehub_theme') || 'system')
    setLanguage(getLocale())
    getSupabase().auth.getUser().then(({ data }) => setEmail(data.user?.email || ''))
  }, [])

  const signOut = async () => {
    await getSupabase().auth.signOut()
    router.replace('/')
  }

  const applyTheme = (value: string) => {
    setTheme(value)
    localStorage.setItem('routehub_theme', value)
    document.documentElement.dataset.theme = value
  }

  const applyLanguage = (value: Locale) => {
    setLanguage(value)
    localStorage.setItem('routehub_language', value)
    document.documentElement.lang = value
  }

  return <main className="app">
    <header className="topbar"><Link className="brand" href="/driver">ROUTEHUB</Link></header>
    <p className="muted">{t.driverWorkspace} · {t.settings}</p>
    <h1>{t.settings}</h1>
    <section className="card"><h2>{t.profile}</h2><p className="muted">{email || t.driverAccount}</p><button className="secondary">{t.editProfile}</button><button className="secondary" style={{ display: 'block', marginTop: 10 }} onClick={signOut}>{t.logout}</button></section>
    <section className="card" style={{ marginTop: 14 }}><h2>{t.preferences}</h2><label>{t.theme}<select value={theme} onChange={e => applyTheme(e.target.value)}><option value="system">{t.system}</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>{t.language}<select value={language} onChange={e => applyLanguage(e.target.value as Locale)}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></label></section>
    <nav className="nav"><Link href="/driver">{t.home}</Link><Link href="/driver/history">{t.history}</Link><Link href="/driver/settings">{t.settings}</Link></nav>
  </main>
}
