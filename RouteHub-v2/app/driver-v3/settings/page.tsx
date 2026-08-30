'use client'
import Link from 'next/link'
import {useState} from 'react'
import {LogOut} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'

const LANGS = [
  {id: 'en', label: 'English'},
  {id: 'es', label: 'Espanol'},
  {id: 'fr', label: 'Francais'},
] as const

export default function DriverV3Settings() {
  const {locale, setLocale, t} = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    const {error} = await getSupabase().auth.signOut()
    if (error) {
      setError('Unable to sign out. Please try again.')
      setBusy(false)
      return
    }
    window.location.assign('/login')
  }

  return (
    <DriverV3Shell active="more" mode="stack" title={t.drvSettings} backHref="/driver/more" backLabel={t.drvMore}>
      <section className="card">
        <p className="eyebrow">{t.drvAccount}</p>
        <h2 style={{margin: '4px 0 8px', fontSize: 18}}>RouteHub Driver</h2>
        <p className="muted" style={{margin: 0}}>
          Session and workspace access are managed by your company.
        </p>
      </section>

      <section className="card" style={{marginTop: 12}}>
        <p className="eyebrow">{t.drvLanguage}</p>
        <div style={{display: 'grid', gap: 8, marginTop: 8}}>
          {LANGS.map(lang => (
            <button
              key={lang.id}
              type="button"
              className="secondary"
              onClick={() => setLocale(lang.id)}
              style={{
                justifyContent: 'flex-start',
                paddingLeft: 14,
                borderColor: locale === lang.id ? '#1667F2' : undefined,
                background: locale === lang.id ? '#EAF2FF' : undefined,
                color: locale === lang.id ? '#1667F2' : undefined,
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card" style={{marginTop: 12}}>
        <Link href="/settings/contact" className="row" style={{textDecoration: 'none', color: 'inherit', minHeight: 52}}>
          {t.drvHelp}
        </Link>
      </section>

      <button
        className="danger"
        disabled={busy}
        onClick={() => void signOut()}
        style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12}}
      >
        <LogOut size={18} />
        {busy ? 'Signing out…' : t.drvSignOut}
      </button>
      {error && (
        <p role="alert" className="muted" style={{marginTop: 10, color: '#b42318'}}>
          {error}
        </p>
      )}
    </DriverV3Shell>
  )
}
