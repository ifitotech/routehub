'use client'
import Link from 'next/link'
import {useState} from 'react'
import styles from '../../../components/driver-v3/driver-v3.module.css'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'
import {startDrivingDay, endDrivingDay} from '../../../lib/driver-v3/actions'
import {getCurrentLocation} from '../../../lib/location'
import {updateDrivingLocation} from '../../../lib/driving-session'

export default function DrivingDayPage() {
  const {loading, error, drivingSession, driverId, companyId, refresh} = useDriverData()
  const {t} = useLocale()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')
  const [confirmEnd, setConfirmEnd] = useState(false)

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
        const session = await startDrivingDay({driverId, companyId})
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
            <p className="muted" style={{marginBottom: 16}}>
              {t.drvDayHelp}
            </p>
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
            <p>Your location sharing for the workday will stop according to the existing operational behavior.</p>
            <div className={styles.confirmActions}>
              <button type="button" className="secondary" disabled={busy} onClick={() => setConfirmEnd(false)}>
                Cancel
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
