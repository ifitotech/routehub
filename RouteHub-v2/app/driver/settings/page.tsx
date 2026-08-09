'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {getSupabase} from '../../../lib/supabase'
import {useLocale, useThemePreference} from '../../../lib/use-preferences'

export default function DriverSettings() {
  const router = useRouter()
  const {locale, t, setLocale} = useLocale()
  const {theme, setTheme} = useThemePreference()
  const [email, setEmail] = useState('')
  useEffect(() => { getSupabase().auth.getUser().then(({data}) => setEmail(data.user?.email || '')) }, [])
  const signOut = async () => { await getSupabase().auth.signOut(); router.replace('/'); router.refresh() }
  return <main className="app driver-dashboard settings-page"><header className="topbar"><Link className="brand" href="/driver">ROUTEHUB</Link><div className="avatar">DR</div></header><p className="eyebrow">{t.driverWorkspace}</p><h1>{t.settings}</h1><section className="card settings-card"><h2>{t.profile}</h2><p className="profile-email">{email || t.driverAccount}</p><button className="secondary">{t.editProfile}</button><button className="danger-outline" onClick={signOut}>{t.logout}</button></section><section className="card settings-card"><h2>{t.preferences}</h2><label>{t.theme}<select value={theme} onChange={event => setTheme(event.target.value)}><option value="system">{t.system}</option><option value="light">{t.light}</option><option value="dark">{t.dark}</option></select></label><label>{t.language}<select value={locale} onChange={event => setLocale(event.target.value)}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></label></section><nav className="nav"><Link href="/driver">{t.home}</Link><Link href="/driver/history">{t.history}</Link><Link href="/driver/settings">{t.settings}</Link></nav></main>
}
