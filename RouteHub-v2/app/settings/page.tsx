'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {useLocale, useThemePreference} from '../../lib/use-preferences'

export default function Settings() {
  const {locale, t, setLocale} = useLocale()
  const {theme, setTheme} = useThemePreference()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [plan, setPlan] = useState('free')
  const [trialEnd, setTrialEnd] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const client = getSupabase(); const {data: userData} = await client.auth.getUser()
      setEmail(userData.user?.email || '')
      if (!userData.user) return
      const {data: membership} = await client.from('company_users').select('company_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
      if (!membership) return
      const {data: company} = await client.from('companies').select('plan,trial_ends_at').eq('id', membership.company_id).maybeSingle()
      if (company) { setPlan(company.plan || 'free'); setTrialEnd(company.trial_ends_at || null) }
    })()
  }, [])

  const signOut = async () => { await getSupabase().auth.signOut(); window.location.assign('/') }

  return <main className="app settings-page"><header className="topbar"><Link className="brand" href="/">ROUTEHUB</Link></header><p className="eyebrow">{t.account.toUpperCase()}</p><h1>{t.settings}</h1>
    <section className="card settings-card"><h2>{t.profile}</h2><p className="muted">{t.signedInEmail}</p><p className="profile-email">{email || t.notSignedIn}</p><button className="secondary" onClick={signOut}>{t.logout}</button></section>
    <section className="card settings-card"><h2>{t.preferences}</h2><label>{t.language}<select value={locale} onChange={event => setLocale(event.target.value)}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></label><label>{t.theme}<select value={theme} onChange={event => setTheme(event.target.value)}><option value="system">{t.system}</option><option value="light">{t.light}</option><option value="dark">{t.dark}</option></select></label></section>
    <section className="card settings-card"><h2>{t.planBilling}</h2><p className="plan-name">{plan === 'free' ? t.free : plan.toUpperCase()}</p><p className="muted">{trialEnd ? `${t.premiumTrial}: ${new Date(trialEnd).toLocaleDateString(locale)}` : t.noTrial}</p><button className="primary" onClick={() => setMessage(t.billingSoon)}>{t.upgradePro}</button></section>
    <section className="card settings-card"><h2>{t.support}</h2><p className="muted">{t.supportHelp}</p><button className="secondary" onClick={() => setMessage(t.supportReady)}>{t.contactSupport}</button>{message && <p className="muted" role="status">{message}</p>}</section>
  </main>
}
