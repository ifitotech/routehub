'use client'

import {driverDetails, routeDate, routeTime, statusLabel, typeLabel} from './routes-model'
import type {RouteRecord} from './routes-model'
import styles from './routes-rows.module.css'

export default function RouteRows({items, locale, c, driverIndex, onCancel}: {
  items: RouteRecord[]
  locale: string
  c: any
  driverIndex?: Map<string, any>
  onCancel?: (route: RouteRecord) => void
}) {
  return (
    <div className={styles.list}>
      {items.map((route, index) => {
        const status = route.status || 'pending'
        const destination = route.destination_name || route.destination_address || c.destinationPending
        const origin = route.origin_name || route.origin_address || c.branch
        const driver = driverDetails(route.driver_id ? driverIndex?.get(route.driver_id) : undefined, c.teamDriver)
        const canCancel = !['completed', 'cancelled'].includes(status)
        return (
          <article key={route.id} className={styles.row} data-status={status}>
            <span className={styles.num}>{String(route.position || index + 1).padStart(2, '0')}</span>
            <div className={styles.main}>
              <small>{typeLabel(route.mission_type, c)}</small>
              <strong>{destination}</strong>
              <span>{origin} → {destination}</span>
            </div>
            <span className={styles.status} data-status={status}>{statusLabel(status, c)}</span>
            <div className={styles.meta}>
              <b>{driver.name}</b>
              <small>{routeDate(route, locale, c)} · {routeTime(route, locale, c)}</small>
              {route.order_number ? <small>{route.order_number}</small> : null}
            </div>
            {canCancel ? (
              <button type="button" className={styles.cancel} onClick={() => onCancel?.(route)}>
                {locale === 'es' ? 'Cancelar' : locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            ) : <span className={styles.spacer} />}
          </article>
        )
      })}
    </div>
  )
}
