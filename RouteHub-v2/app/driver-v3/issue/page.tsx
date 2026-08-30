'use client'
import {useState} from 'react'
import Link from 'next/link'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import shellStyles from '../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {reportIssue} from '../../../lib/driver-v3/actions'

const CATEGORIES = [
  'Customer unavailable',
  'Wrong address',
  'Damaged item',
  'Access problem',
  'Other',
] as const

export default function Issue() {
  const {driverId, snapshot, refresh} = useDriverData()
  const [category, setCategory] = useState<string>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')
  const route = snapshot?.currentOperation?.route as any

  const submit = async () => {
    if (!route || busy) return
    if (!category) {
      setMessageType('err')
      setMessage('Select an issue category.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const text = note.trim() ? `${category}: ${note.trim()}` : category
      await reportIssue({routeId: route.id, driverId, companyId: route.company_id}, text)
      await refresh()
      setMessageType('ok')
      setMessage('Issue submitted.')
      setNote('')
      setCategory('')
    } catch (e) {
      setMessageType('err')
      setMessage(e instanceof Error ? e.message : 'Unable to submit issue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="route">
      <Link href="/driver/stop" className="muted">
        ‹ Stop details
      </Link>
      <p className="eyebrow">ROUTE ISSUE</p>
      <h1 className="title">Report an issue</h1>

      <section className="card">
        {!route ? (
          <p className="muted">No current stop.</p>
        ) : (
          <>
            <p className="muted" style={{marginTop: 0}}>
              {route.destination_name || route.destination_address}
            </p>

            <p className="eyebrow" style={{marginTop: 14}}>
              CATEGORY
            </p>
            <div style={{display: 'grid', gap: 8, marginTop: 8}}>
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  className="secondary"
                  onClick={() => setCategory(c)}
                  style={{
                    justifyContent: 'flex-start',
                    paddingLeft: 14,
                    borderColor: category === c ? '#1667F2' : undefined,
                    background: category === c ? '#EAF2FF' : undefined,
                    color: category === c ? '#1667F2' : undefined,
                    fontWeight: category === c ? 800 : 600,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>

            <label style={{marginTop: 14}}>
              Details (optional)
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Describe what happened"
              />
            </label>

            <div className={shellStyles.stickyAction}>
              <button
                className="primary"
                disabled={busy || !category}
                onClick={() => void submit()}
                style={{background: '#EF5350'}}
              >
                {busy ? 'Submitting…' : 'SUBMIT ISSUE'}
              </button>
            </div>

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
          </>
        )}
      </section>
    </DriverV3Shell>
  )
}
