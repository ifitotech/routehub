'use client'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {CalendarDays, History, LogOut, MapPin, Sparkles} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import DeviceNotificationsSetting from '../../device-notifications-setting'
import InstallAppCard from '../../install-app-card'
import {getCurrentLocation, getLocationPermission} from '../../../lib/location'
import {requestOnboardingReplay} from '../../../lib/onboarding'

const DRIVER_APP_VERSION = '0.1b3'

const LANGS = [
  {id: 'en', label: 'English'},
  {id: 'es', label: 'Español'},
  {id: 'fr', label: 'Français'},
] as const

export default function DriverV3Settings() {
  const {locale, setLocale, t} = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [locationState, setLocationState] = useState('prompt')
  const [locationBusy, setLocationBusy] = useState(false)

  useEffect(() => {
    void getSupabase().auth.getUser().then(({data}) => {
      const user = data.user
      setEmail(user?.email || '')
      setFullName(String(user?.user_metadata?.full_name || user?.user_metadata?.name || ''))
      setPhone(String(user?.user_metadata?.phone || ''))
    })
    void getLocationPermission().then(setLocationState)
  }, [])

  const enableLocation = async () => {
    if (locationBusy) return
    setLocationBusy(true)
    try {
      await getCurrentLocation({maximumAge: 0})
      setLocationState(await getLocationPermission())
    } catch {
      setLocationState(await getLocationPermission())
    } finally {
      setLocationBusy(false)
    }
  }

  const saveProfile = async () => {
    if (saving) return
    setSaving(true)
    const client = getSupabase()
    const {data: authData, error} = await client.auth.updateUser({data: {full_name: fullName.trim(), phone: phone.trim()}})
    if (!error && authData.user) {
      await client.from('users').update({name: fullName.trim(), email: authData.user.email || email}).eq('id', authData.user.id)
    }
    setProfileMsg(error?.message || t.drvSaveProfile)
    if (!error) setEditing(false)
    setSaving(false)
  }

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    const {error} = await getSupabase().auth.signOut()
    if (error) {
      setError(t.drvOpFailed)
      setBusy(false)
      return
    }
    window.location.assign('/login')
  }

  return (
    <DriverV3Shell active="more" mode="stack" title={t.drvSettings} backHref="/driver/more" backLabel={t.drvMore}>
      <section className="card">
        <p className="eyebrow">{t.drvProfile}</p>
        {!editing ? (
          <>
            <h2 style={{margin: '4px 0 8px', fontSize: 18}}>{fullName || 'RouteHub Driver'}</h2>
            <p className="muted" style={{margin: 0}}>{email}</p>
            <p className="muted" style={{margin: '4px 0 0'}}>{phone || t.drvPhone}</p>
          </>
        ) : (
          <>
            <label>
              {t.drvFullName}
              <input value={fullName} onChange={e => setFullName(e.target.value)} />
            </label>
            <label>
              {locale==='es'?'Correo':locale==='fr'?'E-mail':'Email'}
              <input value={email} readOnly />
            </label>
            <label>
              {t.drvPhone}
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </label>
            <button type="button" className="primary" disabled={saving} onClick={() => void saveProfile()}>
              {saving ? t.drvSaving : t.drvSaveProfile}
            </button>
          </>
        )}
        <button type="button" className="secondary" style={{marginTop: 8}} onClick={() => setEditing(v => !v)}>
          {editing ? t.drvCancel : t.drvEditProfile}
        </button>
        {profileMsg && <p className="muted" role="status">{profileMsg}</p>}
      </section>

      <section className="card" style={{marginTop: 12}}>
        <p className="eyebrow">{t.drvWork}</p>
        <Link href="/driver/driving-day" className="row" style={{textDecoration: 'none', color: 'inherit', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10}}>
          <CalendarDays size={18} /> {t.drvDrivingDay}
        </Link>
        <Link href="/driver/history" className="row" style={{textDecoration: 'none', color: 'inherit', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10}}>
          <History size={18} /> {t.drvRouteHistory}
        </Link>
      </section>

      <section className="card" style={{marginTop: 12}}>
        <p className="eyebrow">{t.drvConsentTitle}</p>
        <p className="muted" style={{margin: '4px 0 12px'}}>{t.drvConsentBody}</p>
        <p style={{margin: '0 0 10px', fontWeight: 700}}>
          <MapPin size={16} style={{verticalAlign: 'middle', marginRight: 6}} />
          {locationState === 'granted' ? t.drvActive : locationState === 'denied' ? t.drvOpFailed : t.drvNotStarted}
        </p>
        {locationState !== 'granted' && (
          <button type="button" className="primary" disabled={locationBusy} onClick={() => void enableLocation()}>
            {locationBusy ? t.drvBusy : t.drvConsentCheck}
          </button>
        )}
      </section>

      <div style={{marginTop: 12}}><DeviceNotificationsSetting /></div>
      <div style={{marginTop: 12}}><InstallAppCard /></div>
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
        <p className="eyebrow">{t.drvHelp}</p>
        <Link href="/settings/contact" className="row" style={{textDecoration: 'none', color: 'inherit', minHeight: 52}}>
          {t.drvHelp}
        </Link>
        <button
          type="button"
          className="secondary"
          style={{marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}
          onClick={() => requestOnboardingReplay()}
        >
          <Sparkles size={18} />
          {t.drvTour}
        </button>
      </section>

      <section className="card" style={{marginTop: 12}}>
        <p className="eyebrow">RouteHub Driver</p>
        <p className="muted" style={{margin: 0}}>Version {DRIVER_APP_VERSION}</p>
      </section>

      <button
        className="danger"
        disabled={busy}
        onClick={() => void signOut()}
        style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12}}
      >
        <LogOut size={18} />
        {busy ? t.drvSigningOut : t.drvSignOut}
      </button>
      {error && (
        <p role="alert" className="muted" style={{marginTop: 10, color: '#b42318'}}>
          {error}
        </p>
      )}
    </DriverV3Shell>
  )
}
