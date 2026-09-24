'use client'

import {ChevronDown, ChevronRight, ChevronUp, GripVertical, Package, Pause, Pencil, Play, Truck, Undo2, X} from 'lucide-react'
import {driverDetails, routeTime, statusLabel, typeLabel} from './routes-model'
import type {Driver, RouteRecord} from './routes-model'
import styles from './routes-rows.module.css'

const typeIcons: Record<string, typeof Truck> = {pickup: Package, delivery: Truck, return: Undo2}

export default function RouteRows({items, locale, c, driverIndex, onCancel, onMove, onTogglePause, onUnassign, onAssign, drivers = [], onViewDetails, onEdit, busyRouteId, managing, onDragStart, draggingRouteId, dragOverRouteId}: {
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
  onDragStart?: (routeId: string, event: React.PointerEvent) => void
  draggingRouteId?: string | null
  dragOverRouteId?: string | null
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
        // Every action that changes a route (edit, cancel, reassign, drag,
        // move, pause) requires "Edit routes" (managing) to already be on -
        // one simple rule: nothing changes until that's pressed, so nothing
        // shows as clickable on the normal board where a stray tap could
        // hit a real route by accident.
        const editableStatus = !['completed', 'cancelled', 'active'].includes(status)
        const canCancel = canManage && editableStatus && Boolean(onCancel)
        const canEdit = canManage && editableStatus && Boolean(onEdit)
        // The reorder queue on the server only tracks draft/pending/published/paused
        // routes - an 'issue' route isn't part of it, so a Move button here would
        // click and silently do nothing. Only show it where it can actually work.
        const canMove = canManage && status !== 'active' && status !== 'issue' && Boolean(onMove)
        const canTogglePause = canManage && ['active', 'paused'].includes(status) && Boolean(onTogglePause)
        const canMoveAssignee = canManage && ['draft', 'pending', 'published', 'paused'].includes(status) && Boolean(onAssign && onUnassign && drivers.length)
        const busy = busyRouteId === route.id
        const po = route.mission_type === 'return' ? '' : (route.order_number || '')
        // Dragging works for the driver's current stop too (status 'active')
        // - that's the whole point of the founder's ask: the customer wants
        // it later today, not cancelled, even mid-drive. It only starts once
        // "Edit routes" (managing) is already on, same as Move/Pause below -
        // a stray drag on the normal board is exactly the kind of accident
        // this gate exists to prevent.
        const canDrag = canManage && !['completed', 'cancelled'].includes(status) && Boolean(onDragStart)
        const dragging = draggingRouteId === route.id
        const dragOver = dragOverRouteId === route.id
        const TypeIcon = typeIcons[route.mission_type || ''] || Truck
        return (
          <article
            key={route.id}
            className={styles.row}
            data-status={status}
            data-managing={managing ? 'true' : 'false'}
            data-drag-route={route.id}
            style={{...(canEdit ? {cursor: 'pointer'} : {}), ...(dragging ? {opacity: 0.4} : {}), ...(dragOver ? {outline: '2px dashed var(--rh-primary, #3486FF)', outlineOffset: -2} : {})}}
            onClick={canEdit && !busy ? () => onEdit?.(route) : undefined}
          >
            {canDrag ? (
              <span className={styles.dragHandle} onPointerDown={event => { event.stopPropagation(); onDragStart?.(route.id, event) }} onClick={event => event.stopPropagation()} aria-hidden="true">
                <GripVertical size={16} />
              </span>
            ) : (
              <span className={styles.num}>{String(route.position || index + 1).padStart(2, '0')}</span>
            )}

            <span className={styles.typePill} data-type={route.mission_type || 'delivery'} title={typeLabel(route.mission_type, c)}>
              <TypeIcon size={15} />
            </span>

            <div className={styles.main}>
              <strong>{destination}</strong>
              <small>{origin} → {destination}{po ? ` · ${po}` : ''}</small>
            </div>

            <div className={styles.driverCell}>
              <span className={styles.driverName}>{driver.name}</span>
              <small>{routeTime(route, locale, c)}</small>
            </div>

            <span className={styles.status} data-status={status}>{statusLabel(status, c)}</span>

            {/* Completed/issue routes have no more actions to take on them
                here - what's missing is a way to see how they went (proof
                of delivery, photos, signature). Opens inline in the same
                center column instead of navigating to History, so the
                calendar day being viewed never gets lost. */}
            {(status === 'completed' || status === 'issue') && onViewDetails && (
              <button type="button" className={styles.detailsLink} onClick={event => { event.stopPropagation(); onViewDetails(route.id) }}>
                {label.details}<ChevronRight size={13} />
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
                      <ChevronUp size={14} />
                    </button>
                    <button type="button" className={styles.iconButton} disabled={busy} onClick={() => onMove?.(route, 'down')} title={label.down} aria-label={label.down}>
                      <ChevronDown size={14} />
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
                    {status === 'paused' ? <Play size={13} /> : <Pause size={13} />}
                  </button>
                ) : null}
                {canEdit ? (
                  <button type="button" className={styles.iconButton} disabled={busy} onClick={() => onEdit?.(route)} title={label.edit} aria-label={label.edit}>
                    <Pencil size={13} />
                  </button>
                ) : null}
                {canCancel ? (
                  <button type="button" className={styles.iconButton} data-tone="cancel" disabled={busy} onClick={() => onCancel?.(route)} title={label.cancel} aria-label={label.cancel}>
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
