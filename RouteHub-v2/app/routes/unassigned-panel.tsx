'use client'

import {useState} from 'react'
import {Truck} from 'lucide-react'
import {driverDetails, type Driver, type RouteRecord} from './routes-model'
import styles from './unassigned-panel.module.css'

type UnassignedPanelProps = {
  routes: RouteRecord[]
  drivers: Driver[]
  onAssign: (route: RouteRecord, driverId: string) => void
  onDropRoute?: (routeId: string) => void
  busyRouteId?: string
  locale: string
}

export default function UnassignedPanel({routes, drivers, onAssign, onDropRoute, busyRouteId, locale}: UnassignedPanelProps) {
  const [dropActive, setDropActive] = useState(false)
  const fallback = locale === 'es' ? 'Conductor' : locale === 'fr' ? 'Conducteur' : 'Driver'
  const assignLabel = locale === 'es' ? 'Asignar' : locale === 'fr' ? 'Attribuer' : 'Assign'
  const pickLabel = locale === 'es' ? 'Asignar a...' : locale === 'fr' ? 'Attribuer à...' : 'Assign to...'

  const dropHint = locale === 'es'
    ? 'Suelta aquí para quitar el conductor'
    : locale === 'fr'
      ? 'Déposez ici pour retirer le conducteur'
      : 'Drop here to remove the driver'

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
            return (
              <div key={route.id} className={styles.item}>
                <div className={styles.destination}>{route.destination_name || route.destination_address}</div>
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
                      <option key={driver.user_id} value={driver.user_id}>{driverDetails(driver, fallback).name}</option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}
