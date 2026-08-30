'use client'
import Link from 'next/link'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return 'Route duration unavailable'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'Route duration unavailable'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function typeLabel(t?: string | null) {
  const v = (t || 'delivery').toLowerCase()
  if (v === 'pickup') return 'PICKUP'
  if (v === 'return' || v === 'branch') return 'RETURN'
  return 'DELIVERY'
}

export default function History() {
  const {loading, error, routes} = useDriverData()
  const completed = routes
    .filter((r: any) => r.status === 'completed')
    .slice()
    .sort((a: any, b: any) => {
      const ta = new Date(a.completed_at || a.route_completed_at || 0).getTime()
      const tb = new Date(b.completed_at || b.route_completed_at || 0).getTime()
      return tb - ta
    })

  return (
    <DriverV3Shell active="more">
      <Link href="/driver/more" className="muted">
        ‹ More
      </Link>
      <p className="eyebrow">ACTIVITY</p>
      <h1 className="title">Route History</h1>

      {loading ? (
        <section className="card"><p>Loading history…</p></section>
      ) : error ? (
        <section className="card"><p role="alert">{error}</p></section>
      ) : completed.length === 0 ? (
        <section className="card">
          <h2>No completed routes</h2>
          <p className="muted">Completed work will appear here.</p>
        </section>
      ) : (
        <div style={{display: 'grid', gap: 10}}>
          {completed.map((r: any) => (
            <article className="card" key={r.id}>
              <p className="eyebrow">
                {typeLabel(r.mission_type)} · COMPLETED
              </p>
              <h2 style={{margin: '4px 0 6px', fontSize: 18}}>
                {r.destination_name || r.destination_address || 'Route'}
              </h2>
              {r.destination_name && r.destination_address && (
                <p className="muted" style={{margin: '0 0 6px'}}>
                  {r.destination_address}
                </p>
              )}
              <p className="muted" style={{margin: 0, fontSize: 13}}>
                {r.completed_at || r.route_completed_at
                  ? new Date(r.completed_at || r.route_completed_at).toLocaleString()
                  : 'Completion time unavailable'}
                {r.order_number ? ` · PO ${r.order_number}` : ''}
              </p>
              <p className="muted" style={{margin: '6px 0 0', fontSize: 13, fontWeight: 600}}>
                {formatDuration(r.route_started_at, r.route_completed_at || r.completed_at)}
              </p>
            </article>
          ))}
        </div>
      )}
    </DriverV3Shell>
  )
}
