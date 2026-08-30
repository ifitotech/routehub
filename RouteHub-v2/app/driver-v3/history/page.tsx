'use client'
import Link from 'next/link'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'

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

function typeLabel(kind: string | null | undefined, labels: {drvPickup:string;drvReturn:string;drvDelivery:string}) {
  const v = (kind || 'delivery').toLowerCase()
  if (v === 'pickup') return labels.drvPickup
  if (v === 'return' || v === 'branch') return labels.drvReturn
  return labels.drvDelivery
}

export default function History() {
  const {loading, error, routes} = useDriverData()
  const {t} = useLocale()
  const completed = routes
    .filter((r: any) => r.status === 'completed')
    .slice()
    .sort((a: any, b: any) => {
      const ta = new Date(a.completed_at || a.route_completed_at || 0).getTime()
      const tb = new Date(b.completed_at || b.route_completed_at || 0).getTime()
      return tb - ta
    })

  return (
    <DriverV3Shell active="more" mode="stack" title={t.drvRouteHistory} backHref="/driver/more" backLabel={t.drvMore}>
      

      {loading ? (
        <section className="card"><p className="muted" style={{margin: 0}}>{t.drvLoading}</p></section>
      ) : error ? (
        <section className="card">
          <h2>{t.drvNoHistory}</h2>
          <p className="muted">Try again when your connection is available.</p>
        </section>
      ) : completed.length === 0 ? (
        <section className="card">
          <h2>{t.drvNoHistory}</h2>
          <p className="muted">Completed work will appear here.</p>
        </section>
      ) : (
        <div style={{display: 'grid', gap: 10}}>
          {completed.map((r: any) => (
            <article className="card" key={r.id}>
              <p className="eyebrow">
                {typeLabel(r.mission_type, t)} · {t.drvCompletedTag}
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
                  : t.drvNoCompleteTime}
                {r.order_number ? ` · PO ${r.order_number}` : ''}
              </p>
              <p className="muted" style={{margin: '6px 0 0', fontSize: 13, fontWeight: 600}}>
                {formatDuration(r.route_started_at, r.route_completed_at) === 'Route duration unavailable' ? t.drvDurationNA : formatDuration(r.route_started_at, r.route_completed_at)}
              </p>
            </article>
          ))}
        </div>
      )}
    </DriverV3Shell>
  )
}
