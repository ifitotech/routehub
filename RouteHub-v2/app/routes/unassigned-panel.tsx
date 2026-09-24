'use client'

import {useEffect, useState} from 'react'
import {AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, GripVertical, Pencil, Truck, X} from 'lucide-react'
import {driverDetails, type Driver, type RouteRecord} from './routes-model'
import styles from './unassigned-panel.module.css'

type UnassignedPanelProps = {
  routes: RouteRecord[]
  drivers: Driver[]
  onAssign: (route: RouteRecord, driverId: string) => void
  onEdit?: (route: RouteRecord) => void
  onCancel?: (route: RouteRecord) => void
  busyRouteId?: string
  locale: string
  // Completed/issue routes have nothing left to do in the active board, so
  // they live here instead - out of the way of today's active work, but
  // still one click from their proof-of-delivery details.
  issueRoutes?: RouteRecord[]
  completedRoutes?: RouteRecord[]
  onViewDetails?: (routeId: string) => void
  onDragStart?: (routeId: string, event: React.PointerEvent) => void
  draggingRouteId?: string | null
  dragOverZone?: boolean
  // Nothing here changes a route until "Edit routes" is on - same rule as
  // the assigned list (routes-rows.tsx's canManage) - so a route sitting
  // wrong can be looked at, but not moved/edited/cancelled, from the
  // normal board where a stray tap could hit a real route by accident.
  managing?: boolean
  // Bumped by the empty-state's "View unassigned" button, which has no
  // route of its own to link to - Unassigned lives in this bar, not a page.
  forceOpenSignal?: number
}

type Section = 'unassigned' | 'issues' | 'completed' | null

// A single compact horizontal bar (not a permanent side column) sitting
// above Assigned Routes - Unassigned, Issues and Completed are equally
// "things with nothing left to do in the active queue right now", so they
// share one bar of three segments instead of three separate panels
// competing for space. Clicking a segment reveals its list inline below
// the bar; only one is open at a time. The bar itself (not just the
// flyout) stays a valid drop target at all times, per the drag-and-drop
// feature - dropping a route here works whether or not it's expanded.
export default function UnassignedPanel({routes, drivers, onAssign, onEdit, onCancel, busyRouteId, locale, issueRoutes = [], completedRoutes = [], onViewDetails, onDragStart, draggingRouteId, dragOverZone, managing, forceOpenSignal}: UnassignedPanelProps) {
  const [open, setOpen] = useState<Section>(null)
  const toggle = (section: Section) => setOpen(current => current === section ? null : section)
  useEffect(() => {
    if (forceOpenSignal) setOpen('unassigned')
  }, [forceOpenSignal])
  // Assignees span several branch roles, not just drivers. When a profile has
  // no readable name the role names them, so the picker can't show the same
  // word several times over.
  const roleLabel = (role?: string) => {
    const labels: Record<string, Record<string, string>> = {
      es: {driver: 'Conductor', branch_manager: 'Gerente', operations_manager: 'Operaciones', sales_representative: 'Ventas', counter_sales: 'Mostrador'},
      fr: {driver: 'Conducteur', branch_manager: 'Responsable', operations_manager: 'Opérations', sales_representative: 'Ventes', counter_sales: 'Comptoir'},
      en: {driver: 'Driver', branch_manager: 'Manager', operations_manager: 'Operations', sales_representative: 'Sales', counter_sales: 'Counter'},
    }
    const set = labels[locale] || labels.en
    return set[role || ''] || set.driver
  }
  const nameFor = (driver: Driver) => {
    const role = roleLabel(driver.role)
    const {name} = driverDetails(driver, role)
    return name === role ? role : `${name} · ${role}`
  }
  const pickLabel = locale === 'es' ? 'Mover a conductor…' : locale === 'fr' ? 'Déplacer vers…' : 'Move to driver…'
  const detailsLabel = locale === 'es' ? 'Ver detalles' : locale === 'fr' ? 'Voir les détails' : 'View details'
  const editLabel = locale === 'es' ? 'Editar' : locale === 'fr' ? 'Modifier' : 'Edit'
  const cancelLabel = locale === 'es' ? 'Cancelar' : locale === 'fr' ? 'Annuler' : 'Cancel'
  const unassignedLabel = locale === 'es' ? 'sin asignar' : locale === 'fr' ? 'non attribuées' : 'unassigned'
  const issuesLabel = locale === 'es' ? 'Incidencias' : locale === 'fr' ? 'Incidents' : 'Issues'
  const completedLabel = locale === 'es' ? 'Completadas' : locale === 'fr' ? 'Terminées' : 'Completed'
  const unassignedHint = routes.length === 0
    ? (locale === 'es' ? 'No hay rutas sin asignar por el momento.' : locale === 'fr' ? 'Aucun itinéraire non attribué pour le moment.' : 'No unassigned routes at the moment.')
    : onDragStart
      ? (locale === 'es' ? 'Arrastra una ruta aquí para quitarle el conductor, o haz clic para ver.' : locale === 'fr' ? 'Glissez un itinéraire ici pour retirer son conducteur, ou cliquez pour voir.' : 'Drag a route here to unassign, or click to view.')
      : (locale === 'es' ? 'Haz clic para ver.' : locale === 'fr' ? 'Cliquez pour voir.' : 'Click to view.')
  const routeMeta = (route: RouteRecord) => {
    const type = route.mission_type === 'pickup'
      ? (locale === 'es' ? 'Recogida' : locale === 'fr' ? 'Collecte' : 'Pickup')
      : route.mission_type === 'return'
        ? (locale === 'es' ? 'Regreso' : locale === 'fr' ? 'Retour' : 'Return')
        : (locale === 'es' ? 'Entrega' : locale === 'fr' ? 'Livraison' : 'Delivery')
    const scheduled = route.scheduled_at
      ? new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : locale === 'fr' ? 'fr-FR' : 'en-US', {hour: 'numeric', minute: '2-digit'}).format(new Date(route.scheduled_at))
      : (locale === 'es' ? 'Sin hora' : locale === 'fr' ? 'Sans heure' : 'No time')
    return `${type} · ${scheduled}`
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.bar} ${dragOverZone ? styles.dropZoneActive : ''}`} data-drop-zone="unassigned">
        <button type="button" className={styles.barSegment} onClick={() => toggle('unassigned')} aria-expanded={open === 'unassigned'}>
          <span className={styles.barIcon}><Truck size={16} /></span>
          <span className={styles.barText}>
            <strong>{routes.length} {unassignedLabel}</strong>
            <small>{unassignedHint}</small>
          </span>
        </button>
        <div className={styles.barChips}>
          <button type="button" className={styles.chip} data-tone="issue" onClick={() => toggle('issues')} aria-expanded={open === 'issues'}>
            <AlertTriangle size={13} />{issuesLabel} <b>{issueRoutes.length}</b>
          </button>
          <button type="button" className={styles.chip} data-tone="done" onClick={() => toggle('completed')} aria-expanded={open === 'completed'}>
            <CheckCircle2 size={13} />{completedLabel} <b>{completedRoutes.length}</b>
          </button>
        </div>
      </div>

      {open === 'unassigned' && routes.length > 0 && (
        <div className={styles.flyout}>
          {routes.map(route => {
            const busy = busyRouteId === route.id
            const dragging = draggingRouteId === route.id
            return (
              <div key={route.id} className={styles.item} data-drag-route={route.id} style={dragging ? {opacity: 0.4} : undefined}>
                <div className={styles.destination}>
                  {onDragStart && (
                    <span className={styles.dragHandle} onPointerDown={event => onDragStart(route.id, event)} aria-hidden="true">
                      <GripVertical size={14} />
                    </span>
                  )}
                  {route.destination_name || route.destination_address}
                </div>
                <div className={styles.meta}>{routeMeta(route)}</div>
                {!managing ? null : drivers.length > 0 ? (
                  <select
                    className={styles.assignSelect}
                    disabled={busy}
                    value=""
                    onChange={e => { if (e.target.value) onAssign(route, e.target.value) }}
                    aria-label={`${pickLabel} ${route.destination_name || route.destination_address || ''}`}
                  >
                    <option value="" disabled>{busy ? '…' : pickLabel}</option>
                    {drivers.map(driver => (
                      <option key={driver.user_id} value={driver.user_id}>{nameFor(driver)}</option>
                    ))}
                  </select>
                ) : <p className={styles.empty}>{locale === 'es' ? 'Agrega un miembro disponible para mover esta ruta.' : locale === 'fr' ? 'Ajoutez un membre disponible pour déplacer cet itinéraire.' : 'Add an available team member to move this route.'}</p>}
                {managing && (onEdit || onCancel) && (
                  <div className={styles.rowActions}>
                    {onEdit && (
                      <button type="button" className={styles.actionButton} disabled={busy} onClick={() => onEdit(route)} aria-label={`${editLabel} ${route.destination_name || route.destination_address || ''}`}>
                        <Pencil size={13} />{editLabel}
                      </button>
                    )}
                    {onCancel && (
                      <button type="button" className={styles.actionButton} data-tone="cancel" disabled={busy} onClick={() => onCancel(route)} aria-label={`${cancelLabel} ${route.destination_name || route.destination_address || ''}`}>
                        <X size={13} />{cancelLabel}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {open === 'issues' && (
        <div className={styles.flyout}>
          {issueRoutes.length === 0 ? (
            <p className={styles.empty}>{locale === 'es' ? 'Sin incidencias.' : locale === 'fr' ? 'Aucun incident.' : 'No issues.'}</p>
          ) : issueRoutes.map(route => (
            <div key={route.id} className={styles.item}>
              <div className={styles.destination}>{route.destination_name || route.destination_address}</div>
              {onViewDetails && <button type="button" className={styles.detailsButton} onClick={() => onViewDetails(route.id)}>{detailsLabel}<ChevronRight size={13} /></button>}
            </div>
          ))}
        </div>
      )}

      {open === 'completed' && (
        <div className={styles.flyout}>
          {completedRoutes.length === 0 ? (
            <p className={styles.empty}>{locale === 'es' ? 'Sin completadas.' : locale === 'fr' ? 'Aucun terminé.' : 'Nothing completed yet.'}</p>
          ) : completedRoutes.map(route => (
            <div key={route.id} className={styles.item}>
              <div className={styles.destination}>{route.destination_name || route.destination_address}</div>
              {onViewDetails && <button type="button" className={styles.detailsButton} onClick={() => onViewDetails(route.id)}>{detailsLabel}<ChevronRight size={13} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
