'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'
import {ChevronRight, Map} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {operationalDate} from '../../../lib/driver-queue'
import {openNavigation} from '../../../lib/maps/external-navigation'
import {useLocale} from '../../../lib/use-preferences'
import {routeNumber} from '../../../lib/route-number'

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
  const {t, locale} = useLocale()
  const [day, setDay] = useState(operationalDate())
  const [section, setSection] = useState<'pending' | 'done'>('pending')
  const [query, setQuery] = useState('')
  const currentId = (snapshot?.currentOperation?.route as {id?: string} | undefined)?.id
  const scheduledLabel = locale === 'es' ? 'Programada' : locale === 'fr' ? 'Prévue' : 'Scheduled'

  const rows = useMemo(() => {
    // The route list is a schedule, so its visible order must follow the
    // programmed time—not stop type or the order in which data arrived.
    // Keep the persisted queue position only as a stable fallback for older
    // routes that do not have a scheduled time yet.
    const scheduledTime = (r: {scheduled_at?: string | null}) => {
      const value = r.scheduled_at ? new Date(r.scheduled_at).getTime() : Number.NaN
      return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
    }
    const byScheduledTime = (a: {scheduled_at?: string | null; position?: number | null; id?: string}, b: {scheduled_at?: string | null; position?: number | null; id?: string}) =>
      scheduledTime(a) - scheduledTime(b) || Number(a.position || 0) - Number(b.position || 0) || String(a.id).localeCompare(String(b.id))
    const dayRoutes = routes
      .filter(r => String(r.route_date || '').slice(0, 10) === day)
      .filter(r => String(r.status || '') !== 'cancelled')
    const pending = dayRoutes
      .filter(r => String(r.status || '') !== 'completed')
      .slice()
      .sort(byScheduledTime)
    const done = dayRoutes
      .filter(r => String(r.status || '') === 'completed')
      .slice()
      .sort(byScheduledTime)
    const matches = (r: any) => {
      const q = query.trim().toLowerCase()
      return !q || [routeNumber(r), r.destination_name, r.destination_address, r.order_number].some(v => String(v || '').toLowerCase().includes(q))
    }
    return {pending: pending.filter(matches), done: done.filter(matches), total: dayRoutes.length}
  }, [routes, day, query])

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
        <input aria-label="Search routes" value={query} onChange={event => setQuery(event.target.value)} placeholder="Route, customer, address or PO" style={{width: '100%', minHeight: 48, marginTop: 8, border: '1px solid #dde5ee', borderRadius: 12, padding: '0 12px', font: 'inherit'}} />
      </label>

      {loading ? (
        <section className="card"><p className="muted" style={{margin: 0}}>{t.drvLoading}</p></section>
      ) : error ? (
        <section className="card">
          <h2>{t.drvNoHistory}</h2>
          <p className="muted">{t.drvConnRetry}</p>
        </section>
      ) : rows.total === 0 ? (
        <section className="card">
          <h2>{t.drvNoHistory}</h2>
          <p className="muted">{t.drvHistoryEmpty}</p>
        </section>
      ) : (
        <div style={{display: 'grid', gap: 14}}>
          <div role="tablist" aria-label={t.drvRouteHistory} style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
            {[{id: 'pending' as const, title: t.drvPendingStops, count: rows.pending.length}, {id: 'done' as const, title: t.drvCompletedTag, count: rows.done.length}].map(tab => {
              const selected = section === tab.id
              return <button key={tab.id} type="button" role="tab" aria-selected={selected} onClick={() => setSection(tab.id)} style={{minHeight: 48, border: `1px solid ${selected ? '#1667F2' : '#DDE5EE'}`, borderRadius: 12, background: selected ? '#EAF2FF' : '#fff', color: selected ? '#1667F2' : '#64748B', font: 'inherit', fontWeight: 800, cursor: 'pointer'}}>{tab.title} · {tab.count}</button>
            })}
          </div>
          <section>
            <p className="eyebrow" style={{margin:'0 0 8px'}}>{section === 'pending' ? t.drvPendingStops : t.drvCompletedTag} · {section === 'pending' ? rows.pending.length : rows.done.length}</p>
            <div style={{display: 'grid', gap: 10}}>
          {(section === 'pending' ? rows.pending : rows.done).map((r: any, index: number) => {
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
                    {index + 1}
                  </strong>
                  <div>
                    <p className="eyebrow" style={{margin: 0, color: look.badge}}>
                      {typeLabel(r.mission_type, t)} · {statusText}
                    </p>
                    <p className="muted" style={{margin: '3px 0 0', fontSize: 12, fontWeight: 700}}>ROUTE {routeNumber(r)}</p>
                    <h2 style={{margin: '4px 0 4px', fontSize: 17}}>
                      {r.destination_name || r.destination_address || t.drvRoute}
                    </h2>
                    {r.destination_address ? <p className="muted" style={{margin: 0, fontSize: 13}}>{r.destination_address}</p> : null}
                    {r.scheduled_at ? <p className="muted" style={{margin: '6px 0 0', fontSize: 13}}>{scheduledLabel} {new Date(r.scheduled_at).toLocaleTimeString(locale, {hour: 'numeric', minute: '2-digit'})}</p> : null}
                    {r.order_number && !['return','branch'].includes(String(r.mission_type||r.route_type||'').toLowerCase()) ? <p style={{margin: '8px 0 0', fontSize: 22, lineHeight: '26px', fontWeight: 800, letterSpacing: '-0.02em'}}>PO {r.order_number}</p> : null}
                    {r.route_started_at && (r.completed_at||r.route_completed_at) ? <p className="muted" style={{margin:'6px 0 0',fontSize:13}}>{t.drvOnRouteTime||t.drvStartedAt} {(() => { const ms=new Date(r.completed_at||r.route_completed_at).getTime()-new Date(r.route_started_at).getTime(); if(!Number.isFinite(ms)||ms<0) return t.drvDurationNA; const total=Math.floor(ms/1000); const h=Math.floor(total/3600); const m=Math.floor((total%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; })()}</p> : null}
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
          </section>
        </div>
      )}
    </DriverV3Shell>
  )
}
