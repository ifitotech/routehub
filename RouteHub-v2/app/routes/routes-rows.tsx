'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {Box, Check, ChevronDown, ChevronRight, ChevronUp, Clock, GripVertical, MapPin, MoreHorizontal, Pause, Pencil, Play, Truck, Undo2, X} from 'lucide-react'
import {driverDetails, routeTime, statusLabel, typeLabel} from './routes-model'
import type {Driver, RouteRecord} from './routes-model'
import styles from './routes-rows.module.css'

const typeIcons: Record<string, typeof Truck> = {pickup: Box, delivery: MapPin, return: Undo2}

function initials(name: string) {
  const parts = name.replace(/[—·-]/g, ' ').split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

// Rendered into document.body: the row list scrolls inside .center, which
// would clip an absolutely positioned menu on the last rows.
function RowMenu({label, disabled, children}: {label: string; disabled: boolean; children: (close: () => void) => React.ReactNode}) {
  const [pos, setPos] = useState<{top?: number; bottom?: number; right: number} | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setPos(null), [])

  useEffect(() => {
    if (!pos) return
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [pos, close])

  const toggle = () => {
    if (pos) { close(); return }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const right = Math.max(8, window.innerWidth - rect.right)
    setPos(rect.bottom > window.innerHeight - 240 ? {bottom: window.innerHeight - rect.top + 6, right} : {top: rect.bottom + 6, right})
  }

  return (
    <>
      <button ref={triggerRef} type="button" className={styles.iconButton} disabled={disabled} onClick={toggle} title={label} aria-label={label} aria-haspopup="menu" aria-expanded={Boolean(pos)}>
        <MoreHorizontal size={16} />
      </button>
      {pos && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} className={styles.menu} role="menu" style={{position: 'fixed', ...pos}} onClick={event => event.stopPropagation()}>
          {children(close)}
        </div>,
        document.body,
      )}
    </>
  )
}

export default function RouteRows({items, locale, c, driverIndex, onCancel, onMove, onTogglePause, onUnassign, onAssign, drivers = [], onViewDetails, onEdit, onSave, busyRouteId, editingRouteId, formOpen, managing, onRequestManage, onDragStart, draggingRouteId, dragOverRouteId}: {
  onRequestManage?: () => void
  onSave?: () => void
  editingRouteId?: string | null
  formOpen?: boolean
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
    ? {up: 'Subir', down: 'Bajar', pause: 'Pausar', resume: 'Reanudar', cancel: 'Cancelar', edit: 'Editar', more: 'Más acciones', moveTo: 'Mover a…', unassigned: 'Sin asignar', details: 'Ver detalles', driver: 'Conductor', scheduled: 'Programada', recipient: 'Recibe', drag: 'Arrastrar', locked: 'Editar rutas'}
    : locale === 'fr'
      ? {up: 'Monter', down: 'Descendre', pause: 'Mettre en pause', resume: 'Reprendre', cancel: 'Annuler', edit: 'Modifier', more: 'Plus d’actions', moveTo: 'Déplacer vers…', unassigned: 'Non attribué', details: 'Voir les détails', driver: 'Conducteur', scheduled: 'Prévue', recipient: 'Destinataire', drag: 'Glisser', locked: 'Modifier les itinéraires'}
      : {up: 'Move up', down: 'Move down', pause: 'Pause', resume: 'Resume', cancel: 'Cancel', edit: 'Edit', more: 'More actions', moveTo: 'Move to…', unassigned: 'Unassigned', details: 'View details', driver: 'Driver', scheduled: 'Scheduled', recipient: 'Recipient', drag: 'Drag', locked: 'Edit routes'}

  return (
    <div className={styles.list}>
      {items.map((route, index) => {
        const status = route.status || 'pending'
        const type = route.mission_type === 'pickup' || route.mission_type === 'return' ? route.mission_type : 'delivery'
        const destination = route.destination_name || route.destination_address || c.destinationPending
        const origin = route.origin_name || route.origin_address || c.branch
        const address = route.destination_name && route.destination_address && route.destination_address !== route.destination_name
          ? route.destination_address
          : `${origin} → ${destination}`
        const driver = driverDetails(route.driver_id ? driverIndex?.get(route.driver_id) : undefined, c.teamDriver)
        const canManage = Boolean(managing) && !['completed', 'cancelled'].includes(status)
        // Every action that changes a route (edit, cancel, reassign, drag,
        // move, pause) requires "Edit routes" (managing) to already be on -
        // the buttons stay visible but inert on the normal board, where a
        // stray tap could otherwise hit a real route by accident.
        const editableStatus = !['completed', 'cancelled', 'active'].includes(status)
        const canCancel = canManage && editableStatus && Boolean(onCancel)
        const canEdit = canManage && editableStatus && Boolean(onEdit)
        // The reorder queue on the server only tracks draft/pending/published/paused
        // routes - an 'issue' route isn't part of it, so Move would click and
        // silently do nothing. Only offer it where it can actually work.
        const canMove = canManage && status !== 'active' && status !== 'issue' && Boolean(onMove)
        const canTogglePause = canManage && ['active', 'paused'].includes(status) && Boolean(onTogglePause)
        const canMoveAssignee = canManage && ['draft', 'pending', 'published', 'paused'].includes(status) && Boolean(onAssign && onUnassign && drivers.length)
        const canViewDetails = (status === 'completed' || status === 'issue') && Boolean(onViewDetails)
        const hasMenu = canMoveAssignee || canMove || canTogglePause || canViewDetails
        const busy = busyRouteId === route.id
        const po = route.mission_type === 'return' ? '' : (route.order_number || '')
        // Dragging works for the driver's current stop too (status 'active')
        // - the customer may want it later today, not cancelled, even
        // mid-drive. Same "Edit routes" gate as everything else.
        const canDrag = canManage && Boolean(onDragStart)
        const dragging = draggingRouteId === route.id
        const dragOver = dragOverRouteId === route.id
        const TypeIcon = typeIcons[type] || Truck
        return (
          <article
            key={route.id}
            className={styles.row}
            data-status={status}
            data-type={type}
            data-managing={managing ? 'true' : 'false'}
            data-drag-route={route.id}
            style={{...(canEdit ? {cursor: 'pointer'} : {}), ...(dragging ? {opacity: 0.4} : {}), ...(dragOver ? {outline: '2px dashed var(--rh-primary, #3486FF)', outlineOffset: -2} : {})}}
            onClick={canEdit && !busy ? () => onEdit?.(route) : undefined}
          >
            <span className={styles.num}>{String(route.position || index + 1).padStart(2, '0')}</span>

            <span className={styles.typeIcon}><TypeIcon size={20} /></span>

            <div className={styles.main}>
              <small className={styles.typeLabel}>{typeLabel(route.mission_type, c)}</small>
              <strong>{destination}</strong>
              <small className={styles.address}>{address}</small>
            </div>

            <div className={`${styles.field} ${styles.extraField}`}>
              <small>{type === 'pickup' ? 'PO' : type === 'delivery' ? label.recipient : ''}</small>
              {type === 'pickup' ? (
                <span className={styles.extraValue}>{po || '—'}</span>
              ) : type === 'delivery' ? (
                <span className={styles.extraValue}>
                  <span>{route.destination_contact_name || '—'}</span>
                  {route.destination_phone && <em>{route.destination_phone}</em>}
                </span>
              ) : null}
            </div>

            <div className={`${styles.field} ${styles.driverField}`}>
              <small>{label.driver}</small>
              <span className={styles.driver}><i className={styles.avatar}>{initials(driver.name)}</i><span>{driver.name}</span></span>
            </div>

            <div className={`${styles.field} ${styles.timeField}`}>
              <small>{label.scheduled}</small>
              <span className={styles.time}><Clock size={15} />{routeTime(route, locale, c)}</span>
            </div>

            <span className={styles.status} data-status={status}><i className={styles.statusDot} aria-hidden="true" />{statusLabel(status, c)}</span>

            {!managing ? (
              <div className={styles.actions} onClick={event => event.stopPropagation()}>
                {editingRouteId === route.id && formOpen ? (
                  <button type="button" className={styles.iconButton} disabled={!onSave || busy} onClick={() => onSave?.()} title={label.edit} aria-label={label.edit}>
                    <Check size={16} />
                  </button>
                ) : (
                  <button type="button" className={styles.iconButton} disabled={!onEdit || ['completed', 'cancelled'].includes(status)} onClick={event => { event.stopPropagation(); onEdit?.(route) }} title={label.edit} aria-label={label.edit}>
                    <Pencil size={15} />
                  </button>
                )}
              </div>
            ) : (
            <div className={styles.actions} onClick={event => event.stopPropagation()}>
              <span
                className={styles.grip}
                data-active={canDrag ? 'true' : 'false'}
                onPointerDown={canDrag ? event => { event.stopPropagation(); onDragStart?.(route.id, event) } : undefined}
                title={canDrag ? label.drag : undefined}
                aria-hidden="true"
              >
                <GripVertical size={18} />
              </span>
              <button type="button" className={styles.iconButton} disabled={!canEdit || busy} onClick={() => onEdit?.(route)} title={label.edit} aria-label={label.edit}>
                <Pencil size={15} />
              </button>
              <RowMenu label={label.more} disabled={!hasMenu || busy}>
                {close => (
                  <>
                    {canMoveAssignee && (
                      <select
                        className={styles.moveSelect}
                        defaultValue=""
                        aria-label={`${label.moveTo} ${destination}`}
                        onChange={event => {
                          const value = event.currentTarget.value
                          close()
                          if (value === '__unassigned__') onUnassign?.(route)
                          else if (value) onAssign?.(route, value)
                        }}
                      >
                        <option value="" disabled>{label.moveTo}</option>
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
                    )}
                    {canMove && (
                      <>
                        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { close(); onMove?.(route, 'up') }}><ChevronUp size={15} />{label.up}</button>
                        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { close(); onMove?.(route, 'down') }}><ChevronDown size={15} />{label.down}</button>
                      </>
                    )}
                    {canTogglePause && (
                      <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { close(); onTogglePause?.(route) }}>
                        {status === 'paused' ? <Play size={14} /> : <Pause size={14} />}{status === 'paused' ? label.resume : label.pause}
                      </button>
                    )}
                    {canViewDetails && (
                      <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { close(); onViewDetails?.(route.id) }}><ChevronRight size={15} />{label.details}</button>
                    )}
                  </>
                )}
              </RowMenu>
              <button type="button" className={styles.iconButton} data-tone="cancel" disabled={!canCancel || busy} onClick={() => onCancel?.(route)} title={label.cancel} aria-label={label.cancel}>
                <X size={16} />
              </button>
            </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
