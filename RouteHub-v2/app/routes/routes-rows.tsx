'use client'

import {ChevronDown, ChevronRight, ChevronUp, Pause, Pencil, Play, X} from 'lucide-react'
import {driverDetails, routeDate, routeTime, statusLabel, typeLabel} from './routes-model'
import type {Driver, RouteRecord} from './routes-model'
import styles from './routes-rows.module.css'

export default function RouteRows({items, locale, c, driverIndex, onCancel, onMove, onTogglePause, onUnassign, onAssign, drivers = [], onViewDetails, onEdit, busyRouteId, managing}: {
  items: RouteRecord[]
  locale: string
  c: any
  driverIndex?: Map<string, any>
  onCancel?: (route: RouteRecord) => void
  onMove?: (route: RouteRecord, direction: 'up' | 'down') => void
  onTogglePause?: (route: RouteRecord) => void
  onUnassign?: (route: RouteRecord) => void
  onAssign?: (route: RouteRecord, driverId: string) => void
  drivers?: Driver[]
  onViewDetails?: (routeId: string) => void
  onEdit?: (route: RouteRecord) => void
  busyRouteId?: string
  managing?: boolean
}) {
  const label = locale === 'es'
    ? {up: 'Subir', down: 'Bajar', pause: 'Pausar', resume: 'Reanudar', cancel: 'Cancelar', edit: 'Editar', moveTo: 'Mover a…', unassigned: 'Sin asignar', details: 'Ver detalles'}
    : locale === 'fr'
      ? {up: 'Monter', down: 'Descendre', pause: 'Mettre en pause', resume: 'Reprendre', cancel: 'Annuler', edit: 'Modifier', moveTo: 'Déplacer vers…', unassigned: 'Non attribué', details: 'Voir les détails'}
      : {up: 'Move up', down: 'Move down', pause: 'Pause', resume: 'Resume', cancel: 'Cancel', edit: 'Edit', moveTo: 'Move to…', unassigned: 'Unassigned', details: 'View details'}

  return (
    <div className={styles.list}>
      {items.map((route, index) => {
        const status = route.status || 'pending'
        const destination = route.destination_name || route.destination_address || c.destinationPending
        const origin = route.origin_name || route.origin_address || c.branch
        const driver = driverDetails(route.driver_id ? driverIndex?.get(route.driver_id) : undefined, c.teamDriver)
        const canManage = Boolean(managing) && !['completed', 'cancelled'].includes(status)
        // Edit and Cancel used to only show up once "Edit routes" (managing)
        // was switched on - a route sitting wrong (bad address, time, PO)
        // shouldn't need that extra detour to fix. Reordering and pausing
        // stay behind managing since those are queue operations, not a
        // single route's own details.
        const editableStatus = !['completed', 'cancelled', 'active'].includes(status)
        const canCancel = editableStatus && Boolean(onCancel)
        const canEdit = editableStatus && Boolean(onEdit)
        // The reorder queue on the server only tracks draft/pending/published/paused
        // routes - an 'issue' route isn't part of it, so a Move button here would
        // click and silently do nothing. Only show it where it can actually work.
        const canMove = canManage && status !== 'active' && status !== 'issue' && Boolean(onMove)
        const canTogglePause = canManage && ['active', 'paused'].includes(status) && Boolean(onTogglePause)
        const canMoveAssignee = ['draft', 'pending', 'published', 'paused'].includes(status) && Boolean(onAssign && onUnassign && drivers.length)
        const busy = busyRouteId === route.id
        const po = route.mission_type === 'return' ? '' : (route.order_number || '')
        return (
          <article
            key={route.id}
            className={styles.row}
            data-status={status}
            data-managing={managing ? 'true' : 'false'}
            style={canEdit ? {cursor: 'pointer'} : undefined}
            onClick={canEdit && !busy ? () => onEdit?.(route) : undefined}
          >
            <span className={styles.num}>
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
                  of delivery, photos, signature). Opens inline in the same
                  center column instead of navigating to History, so the
                  calendar day being viewed never gets lost. */}
              {(status === 'completed' || status === 'issue') && onViewDetails && (
                <button type="button" className={styles.detailsLink} onClick={event => { event.stopPropagation(); onViewDetails(route.id) }}>
                  {label.details}<ChevronRight size={14} />
                </button>
              )}
              {canManage || canMoveAssignee || canEdit || canCancel ? (
                <div className={styles.actions} onClick={event => event.stopPropagation()}>
                  {canMoveAssignee ? (
                    <select
                      className={styles.moveSelect}
                      defaultValue=""
                      disabled={busy}
                      aria-label={`${label.moveTo} ${destination}`}
                      onClick={event => event.stopPropagation()}
                      onChange={event => {
                        event.stopPropagation()
                        const value = event.currentTarget.value
                        event.currentTarget.value = ''
                        if (value === '__unassigned__') onUnassign?.(route)
                        else if (value) onAssign?.(route, value)
                      }}
                    >
                      <option value="" disabled>{busy ? '…' : label.moveTo}</option>
                      <option value="__unassigned__">{label.unassigned}</option>
                      {drivers.filter(person => person.user_id !== route.driver_id).map(person => {
                        const roleLabel = locale === 'es'
                          ? ({driver: 'Conductor', branch_manager: 'Gerente', operations_manager: 'Operaciones', sales_representative: 'Ventas', counter_sales: 'Mostrador'} as Record<string, string>)[person.role || ''] || 'Conductor'
                          : locale === 'fr'
                            ? ({driver: 'Conducteur', branch_manager: 'Responsable', operations_manager: 'Opérations', sales_representative: 'Ventes', counter_sales: 'Comptoir'} as Record<string, string>)[person.role || ''] || 'Conducteur'
                            : ({driver: 'Driver', branch_manager: 'Manager', operations_manager: 'Operations', sales_representative: 'Sales', counter_sales: 'Counter'} as Record<string, string>)[person.role || ''] || 'Driver'
                        const personName = driverDetails(person, roleLabel).name
                        return <option key={person.user_id} value={person.user_id}>{personName === roleLabel ? roleLabel : `${personName} · ${roleLabel}`}</option>
                      })}
                    </select>
                  ) : null}
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
                  {canEdit ? (
                    <button type="button" className={styles.iconButton} disabled={busy} onClick={() => onEdit?.(route)} title={label.edit} aria-label={label.edit}>
                      <Pencil size={15} />
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
