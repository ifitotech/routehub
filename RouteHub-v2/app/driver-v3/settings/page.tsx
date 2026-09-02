'use client'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {CalendarDays, ChevronRight, CircleHelp, MapPin, Monitor, Moon, Sparkles, Sun} from 'lucide-react'
import {useLocale, useThemePreference, type ThemePreference} from '../../../lib/use-preferences'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import DeviceNotificationsSetting from '../../device-notifications-setting'
import InstallAppCard from '../../install-app-card'
import {getCurrentLocation, getLocationPermission} from '../../../lib/location'
import {requestOnboardingReplay} from '../../../lib/onboarding'
import {DRIVER_APP_VERSION} from '../../../lib/driver-app-version'
import styles from '../driver-preferences.module.css'


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
      <div className={styles.page}>
        <header className={styles.pageHeader}><p>{locale === 'es' ? 'PREFERENCIAS' : locale === 'fr' ? 'PRÉFÉRENCES' : 'PREFERENCES'}</p><h1>{t.drvSettings}</h1></header>
        <section className={styles.section}>
          <Link href="/driver/driving-day" className={styles.row}>
            <span className={styles.rowIcon}><CalendarDays size={18}/></span><span className={styles.rowCopy}><strong>{t.drvDrivingDay}</strong><small>{locale === 'es' ? 'Turno y disponibilidad' : 'Shift and availability'}</small></span><ChevronRight className={styles.rowChevron} size={19}/>
          </Link>
          <div className={styles.row}>
            <span className={styles.rowIcon}><MapPin size={18}/></span><span className={styles.rowCopy}><strong>{t.drvConsentTitle}</strong><small>{t.drvConsentBody}</small></span><span className={styles.status} data-state={locationState === 'granted' ? 'active' : 'inactive'}>{locationState === 'granted' ? t.drvActive : t.drvNotStarted}</span>
          </div>
          {locationState !== 'granted' && <div className={styles.actionRow}><button type="button" className="primary" disabled={locationBusy} onClick={() => void enableLocation()}>{locationBusy ? t.drvBusy : t.drvConsentCheck}</button></div>}
        </section>
        <section className={styles.section}><DeviceNotificationsSetting /><InstallAppCard /></section>
        <section className={styles.section}>
          <div className={styles.sectionHeader}><h2>{themeCopy.title}</h2><p>{themeCopy.help}</p></div>
          <div className={styles.choices} role="radiogroup" aria-label={themeCopy.title}>
          {themes.map(({id, label, icon: Icon}) => (
            <button
              key={id}
              type="button"
              className={`${styles.choice} ${theme === id ? styles.choiceSelected : ''}`}
              aria-checked={theme === id}
              role="radio"
              onClick={() => setTheme(id)}
            >
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeader}><h2>{t.drvLanguage}</h2></div>
          <div className={styles.languageChoices}>
          {LANGS.map(lang => (
            <button
              key={lang.id}
              type="button"
              className={`${styles.languageChoice} ${locale === lang.id ? styles.languageChoiceSelected : ''}`}
              onClick={() => setLocale(lang.id)}
            >
              {lang.label}
            </button>
          ))}
          </div>
        </section>
        <section className={styles.section}>
          <Link href="/settings/contact" className={styles.row}><span className={styles.rowIcon}><CircleHelp size={18}/></span><span className={styles.rowCopy}><strong>{t.drvHelp}</strong><small>{locale === 'es' ? 'Ayuda, comentarios y soporte' : 'Help, feedback and support'}</small></span><ChevronRight className={styles.rowChevron} size={19}/></Link>
          <div className={styles.actionRow}>
        <button
          type="button"
          className="secondary"
          style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}
          onClick={() => requestOnboardingReplay()}
        >
          <Sparkles size={18} />
          {t.drvTour}
        </button>
          </div>
        </section>
        <p className={styles.footer}>RouteHub Driver · {locale==='es'?'Versión':locale==='fr'?'Version':'Version'} {DRIVER_APP_VERSION}</p>
      </div>
    </DriverV3Shell>
  )
}
