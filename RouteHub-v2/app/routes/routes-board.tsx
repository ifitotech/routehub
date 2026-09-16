'use client'

import {useEffect, useState} from 'react'
import {MapIcon, X} from 'lucide-react'
import {currentMembership} from '../../lib/data'
import {getSupabase} from '../../lib/supabase'
import type {OperationsDriverLocation, OperationsRoute} from '../operations-map'
import CompactMap from '../manager/compact-map'
import styles from './routes-board.module.css'

export default function RoutesBoard({routes, locale}: {routes: OperationsRoute[]; locale: string}) {
  const [drivers, setDrivers] = useState<OperationsDriverLocation[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
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
        setDrivers((sessions || []).flatMap(session => (
          session.last_lat == null || session.last_lng == null ? [] : [{
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
    ? {expand: 'Ampliar mapa', collapse: 'Reducir mapa'}
    : locale === 'fr'
      ? {expand: 'Agrandir la carte', collapse: 'Réduire la carte'}
      : {expand: 'Expand map', collapse: 'Collapse map'}
  return (
    <>
      <div className={styles.mapPane}>
        <CompactMap
          routes={routes}
          driverLocations={drivers}
          locale={locale}
          hideFooter
          expandLabel={copy.expand}
          collapseLabel={copy.collapse}
        />
        <button className={styles.detailsButton} onClick={() => setDetailsOpen(true)} title="Open detailed map">
          <MapIcon size={18} />
          {locale === 'es' ? 'Detalle' : locale === 'fr' ? 'Détail' : 'Details'}
        </button>
      </div>

      {detailsOpen && (
        <div className={styles.detailsModal}>
          <div className={styles.detailsOverlay} onClick={() => setDetailsOpen(false)} />
          <div className={styles.detailsContent}>
            <div className={styles.detailsHeader}>
              <h2>{locale === 'es' ? 'Mapa operativo' : locale === 'fr' ? 'Carte opérationnelle' : 'Operations map'}</h2>
              <button className={styles.closeButton} onClick={() => setDetailsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.detailsBody}>
              <CompactMap
                routes={routes}
                driverLocations={drivers}
                locale={locale}
                hideFooter={false}
                expandLabel={copy.expand}
                collapseLabel={copy.collapse}
              />
            </div>
            <div className={styles.detailsInfo}>
              <div className={styles.infoPanel}>
                <div className={styles.infoItem}>
                  <span className={styles.label}>{locale === 'es' ? 'Total de rutas' : locale === 'fr' ? 'Nombre total d\'itinéraires' : 'Total routes'}</span>
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
