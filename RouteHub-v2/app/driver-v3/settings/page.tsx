'use client'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {Bell, Building2, CalendarDays, ChevronRight, CircleHelp, Download, FileText, LifeBuoy, LogOut, MapPin, Send, Shield} from 'lucide-react'
import {useLocale} from '../../../lib/use-preferences'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import DevicePermissions from '../../../components/driver-v3/DevicePermissions'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {startDrivingDay, endDrivingDay} from '../../../lib/driver-v3/actions'
import {getCurrentLocation} from '../../../lib/location'
import {updateDrivingLocation} from '../../../lib/driving-session'
import {registerPushNotifications, disablePushNotifications} from '../../../lib/push-notifications'
import {DRIVER_APP_VERSION} from '../../../lib/driver-app-version'
import {settingsCopy} from '../../../lib/drv-settings-copy'
import {requestOnboardingReplay} from '../../../lib/onboarding'
import {downloadAndroidUpdate} from '../../../lib/android-update'
import {submitSupportRequest} from '../../../lib/support'
import {getSupabase} from '../../../lib/supabase'
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
  const {drivingSession, driverId, companyId, branchId, refresh} = useDriverData()
  const [dayBusy, setDayBusy] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [message, setMessage] = useState('')
  const [notify, setNotify] = useState<'on' | 'off'>('off')
  const [notifyBusy, setNotifyBusy] = useState(false)
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'downloading' | 'current' | 'available' | 'error'>('idle')
  const [latestVersion, setLatestVersion] = useState('')
  const [workspace, setWorkspace] = useState<{company: string; branch: string}>({company: '', branch: ''})
  const [supportOpen, setSupportOpen] = useState(false)
  const [supportMessage, setSupportMessage] = useState('')
  const [supportSending, setSupportSending] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') setNotify('on')
  }, [])

  useEffect(() => {
    if (!companyId) return
    let gone = false
    const db = getSupabase()
    void Promise.all([
      db.from('companies').select('name').eq('id', companyId).maybeSingle(),
      branchId ? db.from('branches').select('name').eq('id', branchId).maybeSingle() : Promise.resolve({data: null}),
    ]).then(([companyResult, branchResult]) => {
      if (gone) return
      setWorkspace({company: companyResult.data?.name || '', branch: branchResult.data?.name || ''})
    })
    return () => { gone = true }
  }, [companyId, branchId])

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
      setNotifyBusy(true)
      try {
        await disablePushNotifications()
        setNotify('off')
        setMessage(copy.notificationsOff)
      } catch (e) {
        // The device-level unsubscribe failed (rare) - fall back to telling
        // the driver how to silence alerts from iOS itself so they are not
        // stuck thinking Off worked when it may not have.
        setNotify('off')
        setMessage(e instanceof Error ? e.message : copy.notificationsOffHelp)
      } finally {
        setNotifyBusy(false)
      }
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

  const sendSupport = async () => {
    if (supportSending || !supportMessage.trim()) return
    setSupportSending(true)
    try {
      await submitSupportRequest(supportMessage)
      setMessage(copy.supportSent)
      setSupportMessage('')
      setSupportOpen(false)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setSupportSending(false)
    }
  }

  const signOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    await getSupabase().auth.signOut()
    window.location.assign('/login')
  }

  const checkForUpdates = async () => {
    setUpdateState('checking')
    try {
      const response = await fetch(`/routehub-version.json?ts=${Date.now()}`, {cache: 'no-store'})
      if (!response.ok) throw new Error('version check failed')
      const payload = await response.json() as {version?: string}
      const version = typeof payload.version === 'string' ? payload.version : ''
      setLatestVersion(version)
      setUpdateState(version && version !== DRIVER_APP_VERSION ? 'available' : 'current')
    } catch {
      setUpdateState('error')
    }
  }

  const installUpdate = async () => {
    if (!latestVersion) return
    setUpdateState('downloading')
    try {
      const updateFlow = await downloadAndroidUpdate(latestVersion)
      setMessage(updateFlow === 'permission'
        ? (locale === 'es' ? 'Permite que RouteHub instale apps desde esta fuente y vuelve aquí para tocar “Descargar actualización”.' : 'Allow RouteHub to install apps from this source, then return here and tap “Download update”.')
        : (locale === 'es' ? 'Descargando actualización. El instalador de Android se abrirá al terminar.' : 'Downloading update. The Android installer will open when it finishes.'))
      setUpdateState('available')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (locale === 'es' ? 'No se pudo descargar la actualización.' : 'Unable to download the update.'))
      setUpdateState('error')
    }
  }

  return (
    <DriverV3Shell active="more" title={t.drvSettings} hideNav={confirmEnd || confirmSignOut}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <p>{locale === 'es' ? 'PREFERENCIAS' : locale === 'fr' ? 'PRÉFÉRENCES' : 'PREFERENCES'}</p>
          <h1>{t.drvSettings}</h1>
        </header>

        {(workspace.company || workspace.branch) && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><h2>{copy.workspace}</h2></div>
            <div className={styles.row}>
              <span className={styles.rowIcon}><Building2 size={18} /></span>
              <span className={styles.rowCopy}>
                <strong>{workspace.company || copy.company}</strong>
                {workspace.branch ? <small>{copy.branch}: {workspace.branch}</small> : null}
              </span>
            </div>
          </section>
        )}

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
          <a href="/routehub-driver.apk" download="routehub-driver.apk" className={styles.row}>
            <span className={styles.rowIcon}><Download size={18} /></span>
            <span className={styles.rowCopy}>
              <strong>{locale === 'es' ? 'Descargar app Android' : locale === 'fr' ? 'Télécharger l’app Android' : 'Download Android app'}</strong>
              <small>{locale === 'es' ? 'Instala la versión de prueba en cualquier Android' : locale === 'fr' ? 'Installer la version de test sur Android' : 'Install the test build on any Android device'}</small>
            </span>
            <ChevronRight className={styles.rowChevron} size={19} />
          </a>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>{copy.tour}</h2>
            <p>{copy.tourHelp}</p>
          </div>
          <button className={styles.choice} type="button" onClick={requestOnboardingReplay}>
            {copy.tourAction}
          </button>
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
          <div className={styles.sectionHeader}>
            <h2>{copy.contactSupport}</h2>
            <p>{copy.supportHelp}</p>
          </div>
          {supportOpen ? (
            <>
              <textarea
                value={supportMessage}
                onChange={e => setSupportMessage(e.target.value)}
                placeholder={copy.supportPlaceholder}
                rows={4}
                style={{width: '100%', minHeight: 96, boxSizing: 'border-box', border: '1px solid #dde5ee', borderRadius: 12, padding: 10, font: 'inherit', resize: 'vertical'}}
              />
              <button type="button" className={styles.choice} disabled={supportSending || !supportMessage.trim()} onClick={() => void sendSupport()} style={{marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}>
                <Send size={16} />
                {supportSending ? copy.supportSending : copy.supportSend}
              </button>
            </>
          ) : (
            <button type="button" className={styles.row} onClick={() => setSupportOpen(true)}>
              <span className={styles.rowIcon}><LifeBuoy size={18} /></span>
              <span className={styles.rowCopy}><strong>{copy.contactSupport}</strong></span>
              <ChevronRight className={styles.rowChevron} size={19} />
            </button>
          )}
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
        <DevicePermissions locale={locale} />
        {updateState === 'available' || updateState === 'downloading' ? <button type="button" className={styles.row} disabled={updateState === 'downloading'} onClick={() => void installUpdate()}>
          <span className={styles.rowIcon}><Download size={18} /></span>
          <span className={styles.rowCopy}>
            <strong>{updateState === 'downloading' ? (locale === 'es' ? 'Descargando actualización…' : 'Downloading update…') : (locale === 'es' ? 'Descargar actualización' : locale === 'fr' ? 'Télécharger la mise à jour' : 'Download update')}</strong>
            <small>{locale === 'es' ? `Instalar RouteHub ${latestVersion}` : locale === 'fr' ? `Installer RouteHub ${latestVersion}` : `Install RouteHub ${latestVersion}`}</small>
          </span>
          <ChevronRight className={styles.rowChevron} size={19} />
        </button> : <button type="button" className={styles.row} onClick={() => void checkForUpdates()} disabled={updateState === 'checking'}>
          <span className={styles.rowIcon}><Download size={18} /></span>
          <span className={styles.rowCopy}>
            <strong>{locale === 'es' ? 'Buscar actualizaciones' : locale === 'fr' ? 'Rechercher des mises à jour' : 'Check for updates'}</strong>
            <small>{updateState === 'checking' ? (locale === 'es' ? 'Comprobando…' : 'Checking…') : updateState === 'current' ? (locale === 'es' ? 'Tienes la versión más reciente' : 'You have the latest version') : locale === 'es' ? `Versión instalada ${DRIVER_APP_VERSION}` : `Installed version ${DRIVER_APP_VERSION}`}</small>
          </span>
          <ChevronRight className={styles.rowChevron} size={19} />
        </button>}

        <section className={styles.section}>
          <button
            type="button"
            className={`danger ${styles.row}`}
            onClick={() => setConfirmSignOut(true)}
            style={{display: 'flex', alignItems: 'center', gap: 12, width: '100%'}}
          >
            <span className={styles.rowIcon}><LogOut size={18} /></span>
            <span className={styles.rowCopy}><strong>{copy.signOut}</strong></span>
          </button>
        </section>

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

      {confirmSignOut && (
        <div className={confirmStyles.confirmBackdrop} role="dialog" aria-modal="true">
          <div className={confirmStyles.confirmSheet}>
            <h2>{copy.signOutQ}</h2>
            <p>{copy.signOutBody}</p>
            <div className={confirmStyles.confirmActions}>
              <button type="button" className="secondary" disabled={signingOut} onClick={() => setConfirmSignOut(false)}>
                {t.drvCancel}
              </button>
              <button type="button" className="danger" disabled={signingOut} onClick={() => void signOut()}>
                {signingOut ? copy.signingOut : copy.signOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </DriverV3Shell>
  )
}
