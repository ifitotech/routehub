'use client'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {Bell, CalendarDays, ChevronRight, CircleHelp, FileText, MapPin, Monitor, Moon, Shield, Sun} from 'lucide-react'
import {useLocale, useThemePreference, type ThemePreference} from '../../../lib/use-preferences'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {startDrivingDay, endDrivingDay} from '../../../lib/driver-v3/actions'
import {getCurrentLocation} from '../../../lib/location'
import {updateDrivingLocation} from '../../../lib/driving-session'
import {registerPushNotifications} from '../../../lib/push-notifications'
import {DRIVER_APP_VERSION} from '../../../lib/driver-app-version'
import {settingsCopy} from '../../../lib/drv-settings-copy'
import styles from '../driver-preferences.module.css'
import confirmStyles from '../../../components/driver-v3/driver-v3.module.css'

const LANGS = [
  {id: 'en', label: 'English'},
  {id: 'es', label: 'Español'},
  {id: 'fr', label: 'Français'},
] as const

export default function DriverV3Settings() {
  const {locale, setLocale, t} = useLocale()
  const copy = settingsCopy(locale)
  const {theme, setTheme} = useThemePreference()
  const {drivingSession, driverId, companyId, branchId, refresh} = useDriverData()
  const [dayBusy, setDayBusy] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [message, setMessage] = useState('')
  const [notify, setNotify] = useState<'on' | 'off'>('off')
  const [notifyBusy, setNotifyBusy] = useState(false)

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') setNotify('on')
  }, [])

  const dayOn = Boolean(drivingSession)

  const toggleDay = async (wantOn: boolean, confirmed = false) => {
    if (dayBusy || !driverId || !companyId) return
    if (!wantOn && drivingSession && !confirmed) {
      setConfirmEnd(true)
      return
    }
    if (wantOn && drivingSession) return
    setDayBusy(true)
    setMessage('')
    try {
      if (wantOn) {
        window.localStorage.setItem(`routehub-location-consent-v1:${driverId}`, 'accepted')
        const session = await startDrivingDay({driverId, companyId, branchId})
        try {
          const location = await getCurrentLocation({maximumAge: 0})
          if (session?.id) await updateDrivingLocation(session.id, driverId, location)
        } catch {
          /* GPS optional; Driving Day still starts. */
        }
        setMessage(t.drvDayStarted)
      } else if (drivingSession) {
        await endDrivingDay({driverId, sessionId: drivingSession.id})
        setMessage(t.drvDayEnded)
      }
      await refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setDayBusy(false)
      setConfirmEnd(false)
    }
  }

  const toggleNotify = async (wantOn: boolean) => {
    if (notifyBusy) return
    if (!wantOn) {
      setNotify('off')
      setMessage(copy.notificationsOffHelp)
      return
    }
    setNotifyBusy(true)
    try {
      await registerPushNotifications()
      setNotify('on')
      setMessage(copy.notificationsOn)
    } catch (e) {
      setNotify(typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'on' : 'off')
      setMessage(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setNotifyBusy(false)
    }
  }

  const themes: Array<{id: ThemePreference; label: string; icon: typeof Sun}> = [
    {id: 'light', label: t.light, icon: Sun},
    {id: 'dark', label: t.dark, icon: Moon},
    {id: 'system', label: t.system, icon: Monitor},
  ]

  return (
    <DriverV3Shell active="more" title={t.drvSettings} hideNav={confirmEnd}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <p>{locale === 'es' ? 'PREFERENCIAS' : locale === 'fr' ? 'PRÉFÉRENCES' : 'PREFERENCES'}</p>
          <h1>{t.drvSettings}</h1>
        </header>

        <section className={styles.section}>
          <div className={styles.row}>
            <span className={styles.rowIcon}><CalendarDays size={18} /></span>
            <span className={styles.rowCopy}>
              <strong>{t.drvDrivingDay}</strong>
              <small>{dayOn ? t.drvActive : t.drvNotStarted}</small>
            </span>
          </div>
          <div className={`${styles.choices} ${styles.twoChoices}`}>
            <button type="button" className={`${styles.choice} ${!dayOn ? styles.choiceSelected : ''}`} disabled={dayBusy} onClick={() => void toggleDay(false)}>
              {copy.off}
            </button>
            <button type="button" className={`${styles.choice} ${dayOn ? styles.choiceSelected : ''}`} disabled={dayBusy} onClick={() => void toggleDay(true)}>
              {copy.on}
            </button>
          </div>
          <div className={styles.row}>
            <span className={styles.rowIcon}><MapPin size={18} /></span>
            <span className={styles.rowCopy}>
              <strong>{copy.shareLocation}</strong>
              <small>{t.drvConsentBody}</small>
            </span>
            <span className={styles.status} data-state={dayOn ? 'active' : 'inactive'}>
              {dayOn ? t.drvActive : copy.off}
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>{copy.alerts}</h2>
            <p>{copy.notificationsHelp}</p>
          </div>
          <div className={styles.row}>
            <span className={styles.rowIcon}><Bell size={18} /></span>
            <span className={styles.rowCopy}>
              <strong>{copy.deviceNotifications}</strong>
            </span>
          </div>
          <div className={`${styles.choices} ${styles.twoChoices}`}>
            <button type="button" className={`${styles.choice} ${notify === 'off' ? styles.choiceSelected : ''}`} disabled={notifyBusy} onClick={() => void toggleNotify(false)}>
              {copy.off}
            </button>
            <button type="button" className={`${styles.choice} ${notify === 'on' ? styles.choiceSelected : ''}`} disabled={notifyBusy} onClick={() => void toggleNotify(true)}>
              {copy.on}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>{copy.appearance}</h2>
          </div>
          <div className={styles.choices} role="radiogroup" aria-label={copy.appearance}>
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
          <Link href="/terms" className={styles.row}>
            <span className={styles.rowIcon}><FileText size={18} /></span>
            <span className={styles.rowCopy}><strong>{copy.terms}</strong></span>
            <ChevronRight className={styles.rowChevron} size={19} />
          </Link>
          <Link href="/driver/privacy" className={styles.row}>
            <span className={styles.rowIcon}><Shield size={18} /></span>
            <span className={styles.rowCopy}><strong>{copy.privacy}</strong></span>
            <ChevronRight className={styles.rowChevron} size={19} />
          </Link>
          <Link href="/driver/help" className={styles.row}>
            <span className={styles.rowIcon}><CircleHelp size={18} /></span>
            <span className={styles.rowCopy}><strong>{t.drvHelp}</strong></span>
            <ChevronRight className={styles.rowChevron} size={19} />
          </Link>
        </section>

        {message ? <p className={styles.footer} role="status">{message}</p> : null}
        <p className={styles.footer}>RouteHub Driver · {copy.versionLabel} {DRIVER_APP_VERSION}</p>
      </div>

      {confirmEnd && (
        <div className={confirmStyles.confirmBackdrop} role="dialog" aria-modal="true">
          <div className={confirmStyles.confirmSheet}>
            <h2>{t.drvEndDayQ}</h2>
            <p>{t.drvEndShare}</p>
            <div className={confirmStyles.confirmActions}>
              <button type="button" className="secondary" disabled={dayBusy} onClick={() => setConfirmEnd(false)}>
                {t.drvCancel}
              </button>
              <button type="button" className="danger" disabled={dayBusy} onClick={() => void toggleDay(false, true)}>
                {dayBusy ? t.drvBusy : t.drvEndDrivingDay}
              </button>
            </div>
          </div>
        </div>
      )}
    </DriverV3Shell>
  )
}
