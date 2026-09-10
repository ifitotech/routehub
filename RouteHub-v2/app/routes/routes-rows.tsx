'use client'

import {driverDetails, routeDate, routeTime, statusLabel, typeLabel} from './routes-model'
import type {RouteRecord} from './routes-model'
import styles from './routes-rows.module.css'

export default function RouteRows({items, locale, c, driverIndex, onCancel, managing}: {
  items: RouteRecord[]
  locale: string
  c: any
  driverIndex?: Map<string, any>
  onCancel?: (route: RouteRecord) => void
  managing?: boolean
}) {
  return (
    <div className={styles.list}>
      {items.map((route, index) => {
        const status = route.status || 'pending'
        const destination = route.destination_name || route.destination_address || c.destinationPending
        const origin = route.origin_name || route.origin_address || c.branch
        const driver = driverDetails(route.driver_id ? driverIndex?.get(route.driver_id) : undefined, c.teamDriver)
        const canCancel = Boolean(onCancel) && !['completed', 'cancelled'].includes(status)
        const po = route.mission_type === 'return' ? '' : (route.order_number || '')
        return (
          <article key={route.id} className={styles.row} data-status={status} data-managing={managing ? 'true' : 'false'}>
            <span className={styles.num}>{String(route.position || index + 1).padStart(2, '0')}</span>
            <div className={styles.body}>
              <div className={styles.topline}>
                <small>{typeLabel(route.mission_type, c)}</small>
                <span className={styles.status} data-status={status}>{statusLabel(status, c)}</span>
              </div>
              <strong>{destination}</strong>
              <p>{origin} → {destination}</p>
              <p>
                {driver.name}
                {' · '}
                {routeDate(route, locale, c)} {routeTime(route, locale, c)}
                {po ? ` · ${po}` : ''}
              </p>
              {canCancel ? (
                <button type="button" className={styles.cancel} onClick={() => onCancel?.(route)}>
                  {locale === 'es' ? 'Cancelar' : locale === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
