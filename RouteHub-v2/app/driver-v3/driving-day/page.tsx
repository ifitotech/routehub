'use client'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import styles from '../../../components/driver-v3/driver-v3.module.css'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'
import {startDrivingDay, endDrivingDay} from '../../../lib/driver-v3/actions'
import {getCurrentLocation} from '../../../lib/location'
import {updateDrivingLocation} from '../../../lib/driving-session'

export default function DrivingDayPage() {
  const {loading, error, drivingSession, driverId, companyId, branchId, refresh} = useDriverData()
  const {t} = useLocale()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)

  useEffect(() => {
    if (!driverId) return
    setConsentAccepted(window.localStorage.getItem(`routehub-location-consent-v1:${driverId}`) === 'accepted')
  }, [driverId])

  const toggle = async () => {
    if (busy || !driverId || !companyId) return
    setBusy(true)
    setMessage('')
    try {
      if (drivingSession) {
        await endDrivingDay({driverId, sessionId: drivingSession.id})
        setMessageType('ok')
        setMessage(t.drvDayEnded)
      } else {
        if (!consentAccepted) {
          if (!consentChecked) {
            setMessageType('err')
            setMessage(t.drvConsentNeed)
            setBusy(false)
            return
          }
          window.localStorage.setItem(`routehub-location-consent-v1:${driverId}`, 'accepted')
          setConsentAccepted(true)
        }
        const session = await startDrivingDay({driverId, companyId, branchId})
        try {
          const location = await getCurrentLocation({maximumAge: 0})
          if (session?.id) await updateDrivingLocation(session.id, driverId, location)
        } catch {
          /* GPS optional; Driving Day still starts. */
        }
        setMessageType('ok')
        setMessage(t.drvDayStarted)
      }
      await refresh()
    } catch (e) {
      setMessageType('err')
      setMessage(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="more" mode="stack" title={t.drvDrivingDay} backHref="/driver/more" backLabel={t.drvMore} hideNav={confirmEnd}>
      

      {loading ? (
        <section className="card"><p className="muted">{t.drvLoading}</p></section>
      ) : error ? (
        <section className="card"><p role="alert">{error}</p></section>
      ) : (
        <section className="card">
          <p className="eyebrow">{t.drvStatus}</p>
          <h2 style={{margin: '4px 0 8px'}}>
            {drivingSession ? t.drvActive : t.drvNotStarted}
          </h2>
          {drivingSession ? (
            <p className="muted" style={{marginBottom: 16}}>
              {t.drvStartedAt}{' '}
              {new Date(drivingSession.started_at).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          ) : (
            <>
              <p className="muted" style={{marginBottom: 16}}>
                {t.drvDayHelp}
              </p>
              {!consentAccepted && (
                <label style={{display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16}}>
                  <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} />
                  <span>
                    <strong style={{display: 'block'}}>{t.drvConsentTitle}</strong>
                    <span className="muted">{t.drvConsentBody}</span>
                    <span style={{display: 'block', marginTop: 4, fontWeight: 700}}>{t.drvConsentCheck}</span>
                  </span>
                </label>
              )}
            </>
          )}

          <button
            className={drivingSession ? 'danger' : 'primary'}
            disabled={busy || !driverId || !companyId}
            onClick={() => { if (drivingSession) setConfirmEnd(true); else void toggle() }}
          >
            {busy
              ? t.drvBusy
              : drivingSession
                ? t.drvEndDrivingDay
                : t.drvStartDrivingDay}
          </button>

          {message && (
            <p
              role="status"
              className="muted"
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: messageType === 'ok' ? '#EAF9F1' : '#FFF0F0',
                color: messageType === 'ok' ? '#147a4a' : '#b42318',
                fontWeight: 600,
              }}
            >
              {message}
            </p>
          )}
        </section>
      )}

      {confirmEnd && (
        <div className={styles.confirmBackdrop} role="dialog" aria-modal="true">
          <div className={styles.confirmSheet}>
            <h2>{t.drvEndDayQ}</h2>
            <p>{t.drvEndShare}</p>
            <div className={styles.confirmActions}>
              <button type="button" className="secondary" disabled={busy} onClick={() => setConfirmEnd(false)}>
                {t.drvCancel}
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => {
                  setConfirmEnd(false)
                  void toggle()
                }}
              >
                {busy ? t.drvBusy : t.drvEndDrivingDay}
              </button>
            </div>
          </div>
        </div>
      )}
    </DriverV3Shell>
  )
}
