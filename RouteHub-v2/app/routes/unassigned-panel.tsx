'use client'

import {useState} from 'react'
import {AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, GripVertical, Truck} from 'lucide-react'
import {driverDetails, type Driver, type RouteRecord} from './routes-model'
import styles from './unassigned-panel.module.css'

type UnassignedPanelProps = {
  routes: RouteRecord[]
  drivers: Driver[]
  onAssign: (route: RouteRecord, driverId: string) => void
  onDropRoute?: (routeId: string) => void
  busyRouteId?: string
  managing?: boolean
  locale: string
  // Completed/issue routes have nothing left to do in the active board, so
  // they live here instead - out of the way of today's active work, but
  // still one click from their proof-of-delivery details. Without these,
  // this panel goes empty the moment every route is assigned, which reads
  // as broken rather than "caught up".
  issueRoutes?: RouteRecord[]
  completedRoutes?: RouteRecord[]
  onViewDetails?: (routeId: string) => void
}

export default function UnassignedPanel({routes, drivers, onAssign, onDropRoute, busyRouteId, managing, locale, issueRoutes = [], completedRoutes = [], onViewDetails}: UnassignedPanelProps) {
  const [dropActive, setDropActive] = useState(false)
  // Collapsed by default: these are routes with nothing left to do, so the
  // list itself only needs to appear on demand - the count in the header
  // is enough at a glance otherwise.
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [completedOpen, setCompletedOpen] = useState(false)
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
  const assignLabel = locale === 'es' ? 'Asignar' : locale === 'fr' ? 'Attribuer' : 'Assign'
  const pickLabel = locale === 'es' ? 'Asignar a...' : locale === 'fr' ? 'Attribuer à...' : 'Assign to...'
  const detailsLabel = locale === 'es' ? 'Ver detalles' : locale === 'fr' ? 'Voir les détails' : 'View details'
  const issuesLabel = locale === 'es' ? 'Incidencias' : locale === 'fr' ? 'Incidents' : 'Issues'
  const completedLabel = locale === 'es' ? 'Completadas' : locale === 'fr' ? 'Terminées' : 'Completed'

  const dropHint = locale === 'es'
    ? 'Suelta aquí para quitar el conductor'
    : locale === 'fr'
      ? 'Déposez ici pour retirer le conducteur'
      : 'Drop here to remove the driver'
  const dragOutHint = locale === 'es'
    ? 'Arrastra al tablero para asignar'
    : locale === 'fr'
      ? 'Glisser vers le tableau pour attribuer'
      : 'Drag onto the board to assign'

  return (
    <aside
      className={styles.panel}
      data-drop-active={dropActive ? 'true' : 'false'}
      onDragOver={onDropRoute ? event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (!dropActive) setDropActive(true) } : undefined}
      onDragLeave={onDropRoute ? event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropActive(false) } : undefined}
      onDrop={onDropRoute ? event => {
        event.preventDefault()
        setDropActive(false)
        const routeId = event.dataTransfer.getData('text/plain')
        if (routeId) onDropRoute(routeId)
      } : undefined}
    >
      {dropActive && <p className={styles.dropHint}>{dropHint}</p>}
      <div className={styles.header}>
        <div className={styles.headerIcon}><Truck size={18} /></div>
        <div className={styles.headerLabel}>
          <h3>{locale === 'es' ? 'Sin asignar' : locale === 'fr' ? 'Non attribuées' : 'Unassigned'}</h3>
          <span className={styles.count}>{routes.length}</span>
        </div>
      </div>

      {routes.length === 0 ? (
        <p className={styles.empty}>
          {locale === 'es' ? 'Todas las rutas están asignadas.' : locale === 'fr' ? 'Tous les itinéraires sont attribués.' : 'All routes are assigned.'}
        </p>
      ) : (
        <div className={styles.list}>
          {routes.map(route => {
            const busy = busyRouteId === route.id
            const canDrag = Boolean(managing) && !busy
            return (
              <div
                key={route.id}
                className={styles.item}
                data-draggable={canDrag ? 'true' : 'false'}
                draggable={canDrag}
                title={canDrag ? dragOutHint : undefined}
                onDragStart={canDrag ? event => {
                  event.dataTransfer.setData('text/plain', route.id)
                  event.dataTransfer.effectAllowed = 'move'
                } : undefined}
              >
                <div className={styles.destination}>
                  {canDrag ? <GripVertical size={13} className={styles.grip} aria-hidden /> : null}
                  {route.destination_name || route.destination_address}
                </div>
                {drivers.length === 1 ? (
                  <button
                    type="button"
                    className={styles.assignButton}
                    disabled={busy}
                    onClick={() => onAssign(route, drivers[0].user_id)}
                  >
                    {busy ? '…' : assignLabel}
                  </button>
                ) : (
                  <select
                    className={styles.assignSelect}
                    disabled={busy}
                    value=""
                    onChange={e => { if (e.target.value) onAssign(route, e.target.value) }}
                  >
                    <option value="" disabled>{busy ? '…' : pickLabel}</option>
                    {drivers.map(driver => (
                      <option key={driver.user_id} value={driver.user_id}>{nameFor(driver)}</option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}

      {issueRoutes.length > 0 && (
        <div className={styles.subsection}>
          <button type="button" className={styles.subsectionToggle} onClick={() => setIssuesOpen(value => !value)} aria-expanded={issuesOpen}>
            <div className={`${styles.headerIcon} ${styles.headerIconIssue}`}><AlertTriangle size={18} /></div>
            <div className={styles.headerLabel}>
              <h3>{issuesLabel}</h3>
              <span className={styles.count}>{issueRoutes.length}</span>
            </div>
            <ChevronDown size={16} className={issuesOpen ? styles.chevronOpen : styles.chevron} />
          </button>
          {issuesOpen && (
            <div className={styles.list}>
              {issueRoutes.map(route => (
                <div key={route.id} className={styles.item}>
                  <div className={styles.destination}>{route.destination_name || route.destination_address}</div>
                  {onViewDetails && <button type="button" className={styles.detailsButton} onClick={() => onViewDetails(route.id)}>{detailsLabel}<ChevronRight size={13}/></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {completedRoutes.length > 0 && (
        <div className={styles.subsection}>
          <button type="button" className={styles.subsectionToggle} onClick={() => setCompletedOpen(value => !value)} aria-expanded={completedOpen}>
            <div className={`${styles.headerIcon} ${styles.headerIconDone}`}><CheckCircle2 size={18} /></div>
            <div className={styles.headerLabel}>
              <h3>{completedLabel}</h3>
              <span className={styles.count}>{completedRoutes.length}</span>
            </div>
            <ChevronDown size={16} className={completedOpen ? styles.chevronOpen : styles.chevron} />
          </button>
          {completedOpen && (
            <div className={styles.list}>
              {completedRoutes.map(route => (
                <div key={route.id} className={styles.item}>
                  <div className={styles.destination}>{route.destination_name || route.destination_address}</div>
                  {onViewDetails && <button type="button" className={styles.detailsButton} onClick={() => onViewDetails(route.id)}>{detailsLabel}<ChevronRight size={13}/></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
