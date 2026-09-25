'use client'

import {useEffect, useState} from 'react'
import {AlertTriangle, Boxes, CheckCircle2, ChevronRight, GripVertical, Pencil, X} from 'lucide-react'
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
  if (routes.length === 0) return null

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
    : (locale === 'es' ? 'Haz clic para ver.' : locale === 'fr' ? 'Cliquez pour voir.' : 'Click to view.')
  const dropTitle = locale === 'es' ? 'Arrastra una ruta aquí para desasignarla' : locale === 'fr' ? 'Glissez un itinéraire ici pour le désattribuer' : 'Drag a route here to unassign'
  const dropHint = locale === 'es' ? 'Las rutas aparecerán aquí al quedar sin asignar.' : locale === 'fr' ? 'Les itinéraires apparaîtront ici une fois désattribués.' : 'Routes will appear here when unassigned.'
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
          <span className={styles.barIcon}><Boxes size={34} strokeWidth={1.6} /></span>
          <span className={styles.barText}>
            <strong>{routes.length} {unassignedLabel}</strong>
            <small>{unassignedHint}</small>
          </span>
        </button>
        <div className={styles.dropHint} aria-hidden="true">
          <svg className={styles.dropBoxes} viewBox="0 0 124 62">
            <path d="M26 30 40 37 26 44 12 37z" fill="#2a4a74" />
            <path d="M12 37 26 44v14l-14-7z" fill="#16304f" />
            <path d="M26 44 40 37v14l-14 7z" fill="#1d3a60" />
            <path d="M62 6 86 18 62 30 38 18z" fill="#2f5282" />
            <path d="M38 18 62 30v26L38 44z" fill="#17325a" />
            <path d="M62 30 86 18v26L62 56z" fill="#20416c" />
            <path d="M104 30 116 36 104 42 92 36z" fill="#2a4a74" />
            <path d="M92 36 104 42v12l-12-6z" fill="#16304f" />
            <path d="M104 42 116 36v12l-12 6z" fill="#1d3a60" />
          </svg>
          <svg className={styles.dropArrow} viewBox="0 0 64 16">
            <path d="M2 8h52" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 5" strokeLinecap="round" />
            <path d="M52 3l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.dropText}>
            <strong>{dropTitle}</strong>
            <small>{dropHint}</small>
          </span>
        </div>
        <div className={styles.barChips}>
          {issueRoutes.length > 0 && (
            <button type="button" className={styles.chip} data-tone="issue" onClick={() => toggle('issues')} aria-expanded={open === 'issues'}>
              <AlertTriangle size={20} />
              <span>{issuesLabel}</span>
              <b>{issueRoutes.length}</b>
            </button>
          )}
          {completedRoutes.length > 0 && (
            <button type="button" className={styles.chip} data-tone="done" onClick={() => toggle('completed')} aria-expanded={open === 'completed'}>
              <CheckCircle2 size={20} />
              <span>{completedLabel}</span>
              <b>{completedRoutes.length}</b>
            </button>
          )}
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
                {managing && (
                  <div className={styles.itemActions}>
                    {drivers.length > 0 ? (
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
                    {onEdit && (
                      <button type="button" className={styles.iconButton} disabled={busy} onClick={() => onEdit(route)} title={editLabel} aria-label={`${editLabel} ${route.destination_name || route.destination_address || ''}`}>
                        <Pencil size={14} />
                      </button>
                    )}
                    {onCancel && (
                      <button type="button" className={styles.iconButton} data-tone="cancel" disabled={busy} onClick={() => onCancel(route)} title={cancelLabel} aria-label={`${cancelLabel} ${route.destination_name || route.destination_address || ''}`}>
                        <X size={14} />
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
