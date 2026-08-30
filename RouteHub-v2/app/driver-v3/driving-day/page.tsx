'use client'
import Link from 'next/link'
import {useState} from 'react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {startDrivingDay, endDrivingDay} from '../../../lib/driver-v3/actions'

export default function DrivingDayPage() {
  const {loading, error, drivingSession, driverId, companyId, refresh} = useDriverData()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')

  const toggle = async () => {
    if (busy || !driverId || !companyId) return
    setBusy(true)
    setMessage('')
    try {
      if (drivingSession) {
        await endDrivingDay({driverId, sessionId: drivingSession.id})
        setMessageType('ok')
        setMessage('Driving Day ended.')
      } else {
        await startDrivingDay({driverId, companyId})
        setMessageType('ok')
        setMessage('Driving Day started.')
      }
      await refresh()
    } catch (e) {
      setMessageType('err')
      setMessage(e instanceof Error ? e.message : 'Unable to update Driving Day.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="more">
      <Link href="/driver/more" className="muted">
        ‹ More
      </Link>
      <p className="eyebrow">WORK</p>
      <h1 className="title">Driving Day</h1>

      {loading ? (
        <section className="card"><p>Loading driving day…</p></section>
      ) : error ? (
        <section className="card"><p role="alert">{error}</p></section>
      ) : (
        <section className="card">
          <p className="eyebrow">STATUS</p>
          <h2 style={{margin: '4px 0 8px'}}>
            {drivingSession ? 'ACTIVE' : 'NOT STARTED'}
          </h2>
          {drivingSession ? (
            <p className="muted" style={{marginBottom: 16}}>
              Started{' '}
              {new Date(drivingSession.started_at).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          ) : (
            <p className="muted" style={{marginBottom: 16}}>
              Start your Driving Day before beginning routes. Ending the day is separate from
              completing a route.
            </p>
          )}

          <button
            className={drivingSession ? 'danger' : 'primary'}
            disabled={busy || !driverId || !companyId}
            onClick={() => void toggle()}
          >
            {busy
              ? 'Updating…'
              : drivingSession
                ? 'END DRIVING DAY'
                : 'START DRIVING DAY'}
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
    </DriverV3Shell>
  )
}
