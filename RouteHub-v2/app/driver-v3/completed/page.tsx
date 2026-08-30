'use client'
import Link from 'next/link'
import {useState} from 'react'
import {CheckCircle2, List, Play} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {finalizeRoute} from '../../../lib/driver-v3/actions'

export default function Completed() {
  const {loading, error, routes, snapshot, driverId, refresh} = useDriverData()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const done = routes.filter((r: any) => r.status === 'completed')
  const last = done[done.length - 1] as any
  const next = snapshot?.currentOperation?.route as any

  const finish = async () => {
    if (!last || busy) return
    setBusy(true)
    try {
      await finalizeRoute({routeId: last.id, driverId, companyId: last.company_id}, 'normal')
      await refresh()
      setMessage('Route completed.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to complete route.')
    } finally {
      setBusy(false)
    }
  }

  const kind = (last?.mission_type || 'delivery').toString().toUpperCase()

  return (
    <DriverV3Shell active="route">
      {loading ? (
        <section className="card"><p>Loading confirmation…</p></section>
      ) : error ? (
        <section className="card"><p role="alert">{error}</p></section>
      ) : (
        <section className="card" style={{textAlign: 'center', padding: '28px 20px'}}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: '#EAF9F1',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
              color: '#16B96B',
            }}
          >
            <CheckCircle2 size={48} strokeWidth={2.2} />
          </div>
          <h1 className="title" style={{margin: '0 0 6px'}}>Stop Completed!</h1>
          <p className="muted" style={{marginBottom: 20}}>Great job! Keep it moving.</p>

          {last && (
            <div
              style={{
                textAlign: 'left',
                background: '#F7F9FC',
                border: '1px solid #E8EDF3',
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <p className="eyebrow" style={{margin: 0}}>
                {kind}
              </p>
              <h2 style={{margin: '4px 0 2px', fontSize: 18}}>
                {last.destination_name || last.destination_address || 'Stop'}
              </h2>
              {last.order_number && (
                <p className="muted" style={{margin: 0}}>
                  PO {last.order_number}
                </p>
              )}
              {last.completed_at && (
                <p className="muted" style={{margin: '4px 0 0'}}>
                  {new Date(last.completed_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {next ? (
            <>
              <p className="eyebrow">UP NEXT</p>
              <h2 style={{fontSize: 18, margin: '4px 0 14px'}}>
                {next.destination_name || next.destination_address || 'Next stop'}
              </h2>
              <Link
                className="primary"
                href="/driver/stop"
                style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none'}}
              >
                <Play size={18} />
                Continue to Next Stop
              </Link>
            </>
          ) : (
            <>
              <p className="muted" style={{marginBottom: 14}}>
                All required operations are complete. Driving Day remains independent.
              </p>
              <button className="primary" disabled={busy} onClick={() => void finish()}>
                {busy ? 'Finishing…' : 'Complete Route'}
              </button>
            </>
          )}

          <Link
            className="secondary"
            href="/driver/route"
            style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', marginTop: 10}}
          >
            <List size={18} />
            View Route
          </Link>
          {message && (
            <p role="status" className="muted">
              {message}
            </p>
          )}
        </section>
      )}
    </DriverV3Shell>
  )
}
