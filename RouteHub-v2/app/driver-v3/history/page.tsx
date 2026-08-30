'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'
import {ChevronRight, Map} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {operationalDate} from '../../../lib/driver-queue'
import {openNavigation} from '../../../lib/maps/external-navigation'
import {useLocale} from '../../../lib/use-preferences'

function typeLabel(kind: string | null | undefined, labels: Record<string, string>) {
  const v = (kind || 'delivery').toLowerCase()
  if (v === 'pickup') return labels.drvPickup
  if (v === 'return' || v === 'branch') return labels.drvReturn
  return labels.drvDelivery
}

function tone(status: string, isCurrent: boolean) {
  if (status === 'issue') return {border: '#E11D48', bg: '#FFF1F2', badge: '#E11D48', labelKey: 'issue' as const}
  if (status === 'completed') return {border: '#16B96B', bg: '#ECFDF3', badge: '#147A4A', labelKey: 'done' as const}
  if (isCurrent || status === 'active') return {border: '#EAB308', bg: '#FFFBEB', badge: '#B45309', labelKey: 'current' as const}
  return {border: '#CBD5E1', bg: '#fff', badge: '#64748B', labelKey: 'other' as const}
}

export default function History() {
  const {loading, error, routes, snapshot} = useDriverData()
  const {t} = useLocale()
  const [day, setDay] = useState(operationalDate())
  const currentId = (snapshot?.currentOperation?.route as {id?: string} | undefined)?.id

  const rows = useMemo(() => {
    return routes
      .filter(r => String(r.route_date || '').slice(0, 10) === day)
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0))
  }, [routes, day])

  const openMaps = (route: {destination_address?: string; destination_lat?: number; destination_lng?: number; destination_name?: string}) => {
    const url = openNavigation({
      address: route.destination_address,
      coordinate:
        route.destination_lat != null && route.destination_lng != null
          ? {lat: Number(route.destination_lat), lng: Number(route.destination_lng)}
          : null,
      label: route.destination_name,
    })
    if (!url) return
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) window.location.assign(url)
  }

  return (
    <DriverV3Shell active="history" title={t.drvRouteHistory} subtitle={day}>
      <label className="card" style={{display: 'block', marginBottom: 12, padding: '12px 14px'}}>
        <span className="eyebrow" style={{display: 'block', marginBottom: 6}}>{t.drvRouteHistory}</span>
        <input
          type="date"
          value={day}
          onChange={event => setDay(event.target.value || operationalDate())}
          style={{width: '100%', minHeight: 48, border: '1px solid #dde5ee', borderRadius: 12, padding: '0 12px', font: 'inherit'}}
        />
      </label>

      {loading ? (
        <section className="card"><p className="muted" style={{margin: 0}}>{t.drvLoading}</p></section>
      ) : error ? (
        <section className="card">
          <h2>{t.drvNoHistory}</h2>
          <p className="muted">{t.drvConnRetry}</p>
        </section>
      ) : rows.length === 0 ? (
        <section className="card">
          <h2>{t.drvNoHistory}</h2>
          <p className="muted">{t.drvHistoryEmpty}</p>
        </section>
      ) : (
        <div style={{display: 'grid', gap: 10}}>
          {rows.map((r: any, index: number) => {
            const isCurrent = r.id === currentId
            const look = tone(String(r.status || ''), isCurrent)
            const statusText =
              look.labelKey === 'issue'
                ? t.drvIssue
                : look.labelKey === 'done'
                  ? t.drvCompletedTag
                  : look.labelKey === 'current'
                    ? t.drvCurrentStop
                    : String(r.status || '').toUpperCase()
            return (
              <article
                key={r.id}
                className="card"
                style={{background: look.bg, borderColor: look.border, borderLeftWidth: 6, padding: 14}}
              >
                <div style={{display: 'grid', gridTemplateColumns: '36px minmax(0,1fr)', gap: 10, alignItems: 'start'}}>
                  <strong style={{width: 36, height: 36, borderRadius: 18, background: look.badge, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 15}}>
                    {r.position || index + 1}
                  </strong>
                  <div>
                    <p className="eyebrow" style={{margin: 0, color: look.badge}}>
                      {typeLabel(r.mission_type, t)} · {statusText}
                    </p>
                    <h2 style={{margin: '4px 0 4px', fontSize: 17}}>
                      {r.destination_name || r.destination_address || t.drvRoute}
                    </h2>
                    {r.destination_address ? <p className="muted" style={{margin: 0, fontSize: 13}}>{r.destination_address}</p> : null}
                    {r.order_number && !['return','branch'].includes(String(r.mission_type||r.route_type||'').toLowerCase()) ? <p style={{margin: '8px 0 0', fontSize: 22, lineHeight: '26px', fontWeight: 800, letterSpacing: '-0.02em'}}>PO {r.order_number}</p> : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => openMaps(r)}
                  style={{marginTop: 10, minHeight: 44}}
                >
                  <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                    <Map size={16} />
                    {t.drvOpenMaps}
                  </span>
                </button>
              </article>
            )
          })}
        </div>
      )}
    </DriverV3Shell>
  )
}
