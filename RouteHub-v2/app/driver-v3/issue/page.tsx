'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import shellStyles from '../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {reportIssue} from '../../../lib/driver-v3/actions'
import {useLocale} from '../../../lib/use-preferences'

const CATEGORIES = [
  'Customer unavailable',
  'Wrong address',
  'Damaged item',
  'Access problem',
  'Other',
] as const

export default function Issue() {
  const router = useRouter()
  const {t} = useLocale()
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
      router.replace('/driver/stop')
    } catch (e) {
      setMessageType('err')
      setMessage(e instanceof Error ? e.message : 'Unable to submit issue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="route" mode="stack" title={t.drvReportIssue} backHref="/driver/stop" backLabel="Stop">
      

      <section className="card">
        {!route ? (
          <p className="muted">{t.drvNoCurrentStop}</p>
        ) : (
          <>
            <p className="muted" style={{marginTop: 0}}>
              {route.destination_name || route.destination_address}
            </p>

            <p className="eyebrow" style={{marginTop: 14}}>
              {t.drvIssue}
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
              {t.drvDetailsOpt}
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
                {busy ? t.drvBusy : t.drvSubmitIssue}
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
