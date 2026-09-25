'use client'

import {useEffect, useState} from 'react'
import {Clock, Maximize2, MapPin, Package, Route as RouteIcon, Truck, Undo2, X} from 'lucide-react'
import {currentMembership} from '../../lib/data'
import {getSupabase} from '../../lib/supabase'
import type {OperationsDriverLocation, OperationsRoute, OperationsSummary} from '../operations-map'
import {driverDetails, statusLabel, typeLabel} from './routes-model'
import type {Driver, RouteCopy} from './routes-model'
import CompactMap from '../manager/compact-map'
import styles from './routes-board.module.css'

const typeIcons: Record<string, typeof Truck> = {
  delivery: Truck,
  pickup: Package,
  return: Undo2,
}

function routeTimeLabel(scheduledAt: string | null | undefined, locale: string, noTime: string) {
  if (!scheduledAt) return noTime
  const date = new Date(scheduledAt)
  if (Number.isNaN(date.getTime())) return noTime
  return new Intl.DateTimeFormat(locale, {hour: 'numeric', minute: '2-digit'}).format(date)
}

// The dashboard's compact map already has to draw driver routing lines to
// render at all - onSummary hands back the total distance/duration it
// computed for that, for free. Surfacing it here means the total ETA is
// readable without opening the (much bigger) Details modal just to see it.
function formatTotalEta(durationSeconds: number | undefined, locale: string, dash: string) {
  if (!durationSeconds || !Number.isFinite(durationSeconds)) return dash
  const minutes = durationSeconds / 60
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return locale === 'es' || locale === 'fr' ? `${hours} h ${mins} min` : `${hours}h ${mins}m`
}

function formatTotalDistance(distanceMeters: number | undefined, dash: string) {
  if (!distanceMeters || !Number.isFinite(distanceMeters)) return dash
  return `${(distanceMeters / 1609.34).toFixed(1)} mi`
}

export default function RoutesBoard({routes, locale, c, driverIndex, detailsOpen, setDetailsOpen}: {
  routes: OperationsRoute[]
  locale: string
  c: RouteCopy
  driverIndex: Map<string, Driver>
  detailsOpen: boolean
  setDetailsOpen: (open: boolean) => void
}) {
  const [drivers, setDrivers] = useState<OperationsDriverLocation[]>([])
  const [summary, setSummary] = useState<OperationsSummary | null>(null)
  // Pan/zoom only where the map owns a full-height column; stacked below
  // 1201px it sits inside a scrolling page and must not trap touch scroll.
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1201px)')
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const membership = await currentMembership()
        let query = getSupabase()
          .from('driving_sessions')
          .select('id,driver_id,last_lat,last_lng,last_updated_at,status')
          .eq('company_id', membership.company_id)
          .in('status', ['active', 'paused'])
        if (membership.branch_id) query = query.eq('branch_id', membership.branch_id)
        const {data: sessions} = await query
        if (disposed) return
        // A driving_sessions row can sit at 'active'/'paused' for a long time
        // without a fresh GPS write (phone backgrounded, offline, driving day
        // left open). Showing that stale last_lat/last_lng as if it were the
        // driver's current position is exactly what read as "a fake location"
        // on this map - live-route.tsx already treats 10 minutes as the
        // freshness cutoff for the same driving_sessions data, so this
        // filters out anything older instead of trusting every row.
        const freshCutoff = Date.now() - 10 * 60 * 1000
        setDrivers((sessions || []).flatMap(session => (
          session.last_lat == null || session.last_lng == null || !session.last_updated_at || new Date(session.last_updated_at).getTime() < freshCutoff ? [] : [{
            id: String(session.id),
            driver_id: String(session.driver_id),
            location: {lat: Number(session.last_lat), lng: Number(session.last_lng)},
            updatedAt: session.last_updated_at,
            status: 'on_route' as const,
          }]
        )))
      } catch {
        if (!disposed) setDrivers([])
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 15_000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [])
  const copy = locale === 'es'
    ? {expand: 'Ampliar mapa', collapse: 'Reducir mapa', title: 'Mapa operativo', list: 'Rutas de hoy', empty: 'No hay rutas para hoy.', noTime: 'Sin hora', po: 'PO', notes: 'Notas', driver: 'Conductor', totalRoutes: 'Rutas', totalEta: 'ETA total', totalDistance: 'Distancia'}
    : locale === 'fr'
      ? {expand: 'Agrandir la carte', collapse: 'Réduire la carte', title: 'Carte opérationnelle', list: 'Itinéraires du jour', empty: 'Aucun itinéraire aujourd’hui.', noTime: 'Aucune heure', po: 'PO', notes: 'Notes', driver: 'Conducteur', totalRoutes: 'Itinéraires', totalEta: 'ETA totale', totalDistance: 'Distance'}
      : {expand: 'Expand map', collapse: 'Collapse map', title: 'Operations map', list: "Today's routes", empty: 'No routes for today.', noTime: 'No time set', po: 'PO', notes: 'Notes', driver: 'Driver', totalRoutes: 'Routes', totalEta: 'Total ETA', totalDistance: 'Distance'}
  const dash = '—'
  const sortedRoutes = routes.filter(route => route.id !== 'draft-preview').slice().sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
  const activeRouteCount = routes.filter(route => route.id !== 'draft-preview' && route.status !== 'completed' && route.status !== 'cancelled').length
  return (
    <>
      <div className={styles.mapPane}>
        <div className={styles.dashboardStats}>
          <div className={styles.statChip}>
            <i><RouteIcon size={18} /></i>
            <div>
              <span>{copy.totalRoutes}</span>
              <strong>{summary?.count ?? activeRouteCount}</strong>
            </div>
          </div>
          <div className={styles.statChip}>
            <i><Clock size={18} /></i>
            <div>
              <span>{copy.totalEta}</span>
              <strong>{formatTotalEta(summary?.durationSeconds, locale, dash)}</strong>
            </div>
          </div>
          <div className={styles.statChip}>
            <i><MapPin size={18} /></i>
            <div>
              <span>{copy.totalDistance}</span>
              <strong>{formatTotalDistance(summary?.distanceMeters, dash)}</strong>
            </div>
          </div>
        </div>
        <div className={styles.mapWrap}>
          <CompactMap
            routes={routes}
            driverLocations={drivers}
            locale={locale}
            interactive={desktop ? true : undefined}
            hideFooter
            hideLegend={desktop}
            expandLabel={copy.expand}
            collapseLabel={copy.collapse}
            onSummary={setSummary}
          />
          {desktop && (
            <button type="button" className={styles.mapExpand} onClick={() => setDetailsOpen(true)} aria-label={copy.expand} title={copy.expand}>
              <Maximize2 size={16} />
            </button>
          )}
        </div>
      </div>

      {detailsOpen && (
        <div className={styles.detailsModal}>
          <div className={styles.detailsOverlay} onClick={() => setDetailsOpen(false)} />
          <div className={styles.detailsContent}>
            <div className={styles.detailsHeader}>
              <h2>{copy.title}</h2>
              <button className={styles.closeButton} onClick={() => setDetailsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.detailsBody}>
              <div className={styles.detailsMap}>
                <CompactMap
                  routes={routes}
                  driverLocations={drivers}
                  locale={locale}
                  hideFooter={false}
                  expandLabel={copy.expand}
                  collapseLabel={copy.collapse}
                />
              </div>
              <div className={styles.detailsList}>
                <div className={styles.infoPanel}>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>{locale === 'es' ? 'Total de rutas' : locale === 'fr' ? "Nombre total d'itinéraires" : 'Total routes'}</span>
                    <span className={styles.value}>{routes.length}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>{locale === 'es' ? 'En progreso' : locale === 'fr' ? 'En cours' : 'In progress'}</span>
                    <span className={styles.value}>{routes.filter(r => r.status === 'active' || r.status === 'paused').length}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>{locale === 'es' ? 'Completadas' : locale === 'fr' ? 'Terminé' : 'Completed'}</span>
                    <span className={styles.value}>{routes.filter(r => r.status === 'completed').length}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>{locale === 'es' ? 'Pendientes' : locale === 'fr' ? 'En attente' : 'Pending'}</span>
                    <span className={styles.value}>{routes.filter(r => r.status === 'pending' || r.status === 'draft').length}</span>
                  </div>
                </div>

                <h3 className={styles.listHeading}>{copy.list}</h3>
                {sortedRoutes.length === 0 ? (
                  <p className={styles.listEmpty}>{copy.empty}</p>
                ) : (
                  <ul className={styles.routeList}>
                    {sortedRoutes.map(route => {
                      const Icon = typeIcons[route.mission_type || ''] || Truck
                      const driver = route.driver_id ? driverIndex.get(route.driver_id) : undefined
                      const driverName = driver ? driverDetails(driver, c.teamDriver).name : (locale === 'es' ? 'Sin asignar' : locale === 'fr' ? 'Non assigné' : 'Unassigned')
                      return (
                        <li key={route.id} className={styles.routeItem}>
                          <span className={styles.routeIcon}><Icon size={16} /></span>
                          <div className={styles.routeMain}>
                            <div className={styles.routeTopRow}>
                              <strong className={styles.routeType}>{typeLabel(route.mission_type, c)}</strong>
                              <span className={styles.statusBadge} data-status={route.status || 'pending'}>{statusLabel(route.status, c)}</span>
                            </div>
                            <p className={styles.routePath}>
                              <span>{route.origin_address || c.branch}</span>
                              <span className={styles.routeArrow}>→</span>
                              <span>{route.destination_name || route.destination_address || c.destinationPending}</span>
                            </p>
                            <div className={styles.routeMeta}>
                              <span>{copy.driver}: {driverName}</span>
                              <span>{routeTimeLabel(route.scheduled_at, locale, copy.noTime)}</span>
                              {route.order_number && <span>{copy.po}: {route.order_number}</span>}
                              {route.priority && route.priority !== 'normal' && <span className={styles.priorityFlag} data-priority={route.priority}>{route.priority === 'urgent' ? c.urgent : c.priorityName}</span>}
                            </div>
                            {route.notes && <p className={styles.routeNotes}>{copy.notes}: {route.notes}</p>}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
