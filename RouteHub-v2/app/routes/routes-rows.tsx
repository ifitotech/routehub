'use client'

import Link from 'next/link'
import {ChevronDown, ChevronRight, ChevronUp, CornerUpLeft, GripVertical, Pause, Play, X} from 'lucide-react'
import {driverDetails, routeDate, routeTime, statusLabel, typeLabel} from './routes-model'
import type {RouteRecord} from './routes-model'
import styles from './routes-rows.module.css'

export default function RouteRows({items, locale, c, driverIndex, onCancel, onMove, onTogglePause, onUnassign, busyRouteId, managing}: {
  items: RouteRecord[]
  locale: string
  c: any
  driverIndex?: Map<string, any>
  onCancel?: (route: RouteRecord) => void
  onMove?: (route: RouteRecord, direction: 'up' | 'down') => void
  onTogglePause?: (route: RouteRecord) => void
  onUnassign?: (route: RouteRecord) => void
  busyRouteId?: string
  managing?: boolean
}) {
  const label = locale === 'es'
    ? {up: 'Subir', down: 'Bajar', pause: 'Pausar', resume: 'Reanudar', cancel: 'Cancelar', unassign: 'Mover a sin asignar', drag: 'Arrastra a Sin asignar', details: 'Ver detalles'}
    : locale === 'fr'
      ? {up: 'Monter', down: 'Descendre', pause: 'Mettre en pause', resume: 'Reprendre', cancel: 'Annuler', unassign: 'Déplacer vers non attribué', drag: 'Glisser vers Non attribuées', details: 'Voir les détails'}
      : {up: 'Move up', down: 'Move down', pause: 'Pause', resume: 'Resume', cancel: 'Cancel', unassign: 'Move to unassigned', drag: 'Drag to Unassigned', details: 'View details'}

  return (
    <div className={styles.list}>
      {items.map((route, index) => {
        const status = route.status || 'pending'
        const destination = route.destination_name || route.destination_address || c.destinationPending
        const origin = route.origin_name || route.origin_address || c.branch
        const driver = driverDetails(route.driver_id ? driverIndex?.get(route.driver_id) : undefined, c.teamDriver)
        const canManage = Boolean(managing) && !['completed', 'cancelled'].includes(status)
        const canCancel = canManage && status !== 'active' && Boolean(onCancel)
        // The reorder queue on the server only tracks draft/pending/published/paused
        // routes - an 'issue' route isn't part of it, so a Move button here would
        // click and silently do nothing. Only show it where it can actually work.
        const canMove = canManage && status !== 'active' && status !== 'issue' && Boolean(onMove)
        const canTogglePause = canManage && ['active', 'paused'].includes(status) && Boolean(onTogglePause)
        const canUnassign = canManage && status !== 'active' && Boolean(route.driver_id) && Boolean(onUnassign)
        const busy = busyRouteId === route.id
        const po = route.mission_type === 'return' ? '' : (route.order_number || '')
        return (
          <article
            key={route.id}
            className={styles.row}
            data-status={status}
            data-managing={managing ? 'true' : 'false'}
            data-draggable={canUnassign ? 'true' : 'false'}
            draggable={canUnassign && !busy}
            title={canUnassign ? label.drag : undefined}
            onDragStart={canUnassign ? event => {
              event.dataTransfer.setData('text/plain', route.id)
              event.dataTransfer.effectAllowed = 'move'
            } : undefined}
          >
            <span className={styles.num}>
              {canUnassign ? <GripVertical size={14} className={styles.grip} aria-hidden /> : null}
              {String(route.position || index + 1).padStart(2, '0')}
            </span>
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
              {/* Completed/issue routes have no more actions to take on them
                  here - what's missing is a way to see how they went (proof
                  of delivery, photos, signature), which already lives in
                  History. Link there pre-searched for this route's
                  destination instead of duplicating that whole view here. */}
              {(status === 'completed' || status === 'issue') && (
                <Link className={styles.detailsLink} href={`/manager/history?q=${encodeURIComponent(destination)}&id=${route.id}`}>
                  {label.details}<ChevronRight size={14} />
                </Link>
              )}
              {canManage ? (
                <div className={styles.actions}>
                  {canMove ? (
                    <>
                      <button type="button" className={styles.iconButton} disabled={busy} onClick={() => onMove?.(route, 'up')} title={label.up} aria-label={label.up}>
                        <ChevronUp size={16} />
                      </button>
                      <button type="button" className={styles.iconButton} disabled={busy} onClick={() => onMove?.(route, 'down')} title={label.down} aria-label={label.down}>
                        <ChevronDown size={16} />
                      </button>
                    </>
                  ) : null}
                  {canTogglePause ? (
                    <button
                      type="button"
                      className={styles.iconButton}
                      data-tone={status === 'paused' ? 'resume' : 'pause'}
                      disabled={busy}
                      onClick={() => onTogglePause?.(route)}
                      title={status === 'paused' ? label.resume : label.pause}
                      aria-label={status === 'paused' ? label.resume : label.pause}
                    >
                      {status === 'paused' ? <Play size={15} /> : <Pause size={15} />}
                    </button>
                  ) : null}
                  {canUnassign ? (
                    <button type="button" className={styles.iconButton} data-tone="unassign" disabled={busy} onClick={() => onUnassign?.(route)} title={label.unassign} aria-label={label.unassign}>
                      <CornerUpLeft size={15} />
                    </button>
                  ) : null}
                  {canCancel ? (
                    <button type="button" className={styles.iconButton} data-tone="cancel" disabled={busy} onClick={() => onCancel?.(route)} title={label.cancel} aria-label={label.cancel}>
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
