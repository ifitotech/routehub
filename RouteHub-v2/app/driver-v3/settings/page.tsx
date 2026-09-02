'use client'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {CalendarDays, MapPin, Monitor, Moon, Sparkles, Sun} from 'lucide-react'
import {useLocale, useThemePreference, type ThemePreference} from '../../../lib/use-preferences'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import DeviceNotificationsSetting from '../../device-notifications-setting'
import InstallAppCard from '../../install-app-card'
import {getCurrentLocation, getLocationPermission} from '../../../lib/location'
import {requestOnboardingReplay} from '../../../lib/onboarding'
import {DRIVER_APP_VERSION} from '../../../lib/driver-app-version'


const LANGS = [
  {id: 'en', label: 'English'},
  {id: 'es', label: 'Español'},
  {id: 'fr', label: 'Français'},
] as const

export default function DriverV3Settings() {
  const {locale, setLocale, t} = useLocale()
  const {theme, setTheme} = useThemePreference()
  const [locationState, setLocationState] = useState('prompt')
  const [locationBusy, setLocationBusy] = useState(false)

  useEffect(() => {
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

  const themeCopy = locale === 'es'
    ? {title: 'Tema de la app', light: 'Claro', dark: 'Oscuro', system: 'Sistema', help: 'Elige cómo se ve RouteHub en este dispositivo.'}
    : locale === 'fr'
      ? {title: 'Thème de l’application', light: 'Clair', dark: 'Sombre', system: 'Système', help: 'Choisissez l’apparence de RouteHub sur cet appareil.'}
      : {title: 'App theme', light: 'Light', dark: 'Dark', system: 'System', help: 'Choose how RouteHub looks on this device.'}
  const themes: Array<{id: ThemePreference; label: string; icon: typeof Sun}> = [
    {id: 'light', label: themeCopy.light, icon: Sun},
    {id: 'dark', label: themeCopy.dark, icon: Moon},
    {id: 'system', label: themeCopy.system, icon: Monitor},
  ]

  return (
    <DriverV3Shell active="more" title={t.drvSettings}>
      <section className="card" style={{marginTop: 12}}>
        <Link href="/driver/driving-day" className="row" style={{textDecoration: 'none', color: 'inherit', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10}}>
          <CalendarDays size={18} /> {t.drvDrivingDay}
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
        <p className="eyebrow">{themeCopy.title}</p>
        <p className="muted" style={{margin: '4px 0 12px'}}>{themeCopy.help}</p>
        <div className="driver-theme-options" role="radiogroup" aria-label={themeCopy.title}>
          {themes.map(({id, label, icon: Icon}) => (
            <button
              key={id}
              type="button"
              className={`driver-theme-option ${theme === id ? 'is-selected' : ''}`}
              aria-checked={theme === id}
              role="radio"
              onClick={() => setTheme(id)}
            >
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </div>
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
        <p className="muted" style={{margin: 0}}>{locale==='es'?'Versión':locale==='fr'?'Version':'Version'} {DRIVER_APP_VERSION}</p>
        <p className="muted" style={{margin: '4px 0 0', fontSize: 12}}>2026-09-02 · main</p>
      </section>

    </DriverV3Shell>
  )
}
