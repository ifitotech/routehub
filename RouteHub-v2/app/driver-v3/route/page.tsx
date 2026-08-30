'use client'
import Link from 'next/link'
import {CheckCircle2, ChevronRight} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'
import {operationalDate} from '../../../lib/driver-queue'

export default function DriverV3Route() {
  const {loading, error, snapshot, refresh, routes} = useDriverData()
  const {t} = useLocale()
  const today = operationalDate()
  const current = snapshot?.currentOperation?.route as any
  const queueRoutes = routes
    .filter((r: any) => (r.route_date || '').slice(0, 10) === today)
    .slice()
    .sort((a: any, b: any) => (a.position || 0) - (b.position || 0) || String(a.id).localeCompare(String(b.id)))
  const activeRows = queueRoutes.filter((r: any) => r.status !== 'cancelled')
  const doneCount = activeRows.filter((r: any) => r.status === 'completed').length
  const issueCount = queueRoutes.filter((r: any) => r.status === 'issue').length
  const remaining = Math.max(0, activeRows.length - doneCount)

  const typeLabel = (r: any) => {
    const v = (r.mission_type || 'delivery').toString().toLowerCase()
    if (v === 'pickup') return t.drvPickup
    if (v === 'return' || v === 'branch') return t.drvReturn
    return t.drvDelivery
  }

  const typeColor = (r: any) => {
    const t = (r.mission_type || 'delivery').toString().toLowerCase()
    if (t === 'pickup') return {bg: '#E8FAFC', color: '#0EA5B7'}
    if (t === 'return' || t === 'branch') return {bg: '#EEF2F7', color: '#0F1D35'}
    return {bg: '#F2ECFF', color: '#7C3AED'}
  }

  return (
    <DriverV3Shell active="route" title={t.drvMyRoute}>

      {loading ? (
        <section className="card"><p className="muted" style={{margin: 0}}>{t.drvLoadingRoute}</p></section>
      ) : error ? (
        <section className="card">
          <h2>{t.drvCouldntLoad}</h2>
          <p className="muted">{t.drvConnRetry}</p>
          <button type="button" className="primary" onClick={() => void refresh()}>
            {t.drvTryAgainBtn}
          </button>
        </section>
      ) : (
        <>
          <section className="card" style={{display: 'flex', gap: 16, alignItems: 'center'}}>
            <div>
              <strong style={{fontSize: 20}}>{queueRoutes.length}</strong>
              <span className="muted" style={{display: 'block', fontSize: 12}}>
                {t.drvStopsWord}
              </span>
            </div>
            <div style={{width: 1, height: 28, background: '#E8EDF3'}} />
            <div>
              <strong style={{fontSize: 20, color: '#16B96B'}}>{doneCount}</strong>
              <span className="muted" style={{display: 'block', fontSize: 12}}>
                {t.drvDoneWord}
              </span>
            </div>
            <div style={{width: 1, height: 28, background: '#E8EDF3'}} />
            <div>
              <strong style={{fontSize: 20}}>{remaining}</strong>
              <span className="muted" style={{display: 'block', fontSize: 12}}>
                {t.drvLeftWord}
              </span>
            </div>
          </section>

          <div style={{marginTop: 14, display: 'grid', gap: 10}}>
            {queueRoutes.length === 0 && (
              <section className="card">
                <h2>{t.drvNoStops}</h2>
                <p className="muted">{t.drvAssignedOrder}</p>
              </section>
            )}
            {queueRoutes.map((route: any, index: number) => {
              const isCurrent = route.id === current?.id
              const isDone = route.status === 'completed'
              const colors = typeColor(route)
              return (
                <Link
                  key={route.id}
                  href={`/driver/stop?id=${encodeURIComponent(route.id)}`}
                  style={{textDecoration: 'none', color: 'inherit'}}
                >
                  <article
                    className="card"
                    style={{
                      marginBottom: 0,
                      border: isCurrent ? '2px solid #1667F2' : undefined,
                      background: isCurrent ? '#EAF2FF' : isDone ? '#F7F9FC' : '#fff',
                      opacity: isDone ? 0.72 : 1,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: isDone ? '#16B96B' : isCurrent ? '#1667F2' : '#E8EDF3',
                        color: isDone || isCurrent ? '#fff' : '#667892',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {isDone ? <CheckCircle2 size={16} /> : route.position || index + 1}
                    </div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <span
                        style={{
                          display: 'inline-flex',
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 8,
                          background: colors.bg,
                          color: colors.color,
                          marginBottom: 4,
                        }}
                      >
                        {typeLabel(route)}
                      </span>
                      <h2 style={{margin: '4px 0 2px', fontSize: 17, lineHeight: 1.25}}>
                        {route.destination_name || route.destination_address || t.drvCurrentStopName}
                      </h2>
                      <p className="muted" style={{margin: 0, fontSize: 13}}>
                        {route.destination_address || route.status}
                        {route.order_number ? ` · ${route.order_number}` : ''}
                      </p>
                      {isCurrent && (
                        <span className="tag" style={{marginTop: 6}}>
                          {t.drvCurrentStop}
                        </span>
                      )}
                      {route.status === 'issue' && (
                        <span className="tag" style={{marginTop: 6, background: '#FFF0F0', color: '#b42318'}}>
                          {t.drvIssue}
                        </span>
                      )}
                      {route.status === 'cancelled' && (
                        <span className="tag" style={{marginTop: 6}}>{t.drvPaused}</span>
                      )}
                      {route.status === 'paused' && (
                        <span className="tag" style={{marginTop: 6}}>{t.drvPaused}</span>
                      )}
                    </div>
                    <ChevronRight size={18} color="#8A97A8" style={{marginTop: 6, flexShrink: 0}} />
                  </article>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </DriverV3Shell>
  )
}
