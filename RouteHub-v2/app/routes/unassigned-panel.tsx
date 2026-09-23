'use client'

import {useState} from 'react'
import {AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Truck} from 'lucide-react'
import {driverDetails, type Driver, type RouteRecord} from './routes-model'
import styles from './unassigned-panel.module.css'

type UnassignedPanelProps = {
  routes: RouteRecord[]
  drivers: Driver[]
  onAssign: (route: RouteRecord, driverId: string) => void
  busyRouteId?: string
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

export default function UnassignedPanel({routes, drivers, onAssign, busyRouteId, locale, issueRoutes = [], completedRoutes = [], onViewDetails}: UnassignedPanelProps) {
  // Both start collapsed - an open list (especially Issues, which can run
  // long) crowded out Unassigned above it and made the panel feel heavy to
  // scan. The header (with its count) always shows on its own either way,
  // so nothing goes missing - it's just a click away instead of forced open.
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
  const pickLabel = locale === 'es' ? 'Mover a conductor…' : locale === 'fr' ? 'Déplacer vers…' : 'Move to driver…'
  const detailsLabel = locale === 'es' ? 'Ver detalles' : locale === 'fr' ? 'Voir les détails' : 'View details'
  const issuesLabel = locale === 'es' ? 'Incidencias' : locale === 'fr' ? 'Incidents' : 'Issues'
  const completedLabel = locale === 'es' ? 'Completadas' : locale === 'fr' ? 'Terminées' : 'Completed'

  return (
    <aside className={styles.panel}>
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
            return (
              <div key={route.id} className={styles.item}>
                <div className={styles.destination}>
                  {route.destination_name || route.destination_address}
                </div>
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
              </div>
            )
          })}
        </div>
      )}

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
          issueRoutes.length === 0 ? (
            <p className={styles.empty}>
              {locale === 'es' ? 'Sin incidencias.' : locale === 'fr' ? 'Aucun incident.' : 'No issues.'}
            </p>
          ) : (
            <div className={styles.list}>
              {issueRoutes.map(route => (
                <div key={route.id} className={styles.item}>
                  <div className={styles.destination}>{route.destination_name || route.destination_address}</div>
                  {onViewDetails && <button type="button" className={styles.detailsButton} onClick={() => onViewDetails(route.id)}>{detailsLabel}<ChevronRight size={13}/></button>}
                </div>
              ))}
            </div>
          )
        )}
      </div>

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
