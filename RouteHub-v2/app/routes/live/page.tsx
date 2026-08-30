'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {ArrowLeft, MapPinned, Route as RouteIcon} from 'lucide-react'
import {currentMembership} from '../../../lib/data'
import {loadManagerDashboard, managerOperationalDate} from '../../../lib/dashboard'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import ManagerShell from '../../manager/manager-shell'
import type {OperationsDriverLocation, OperationsRoute} from '../../operations-map'
import styles from './live.module.css'

const OperationsMap = dynamic(() => import('../../operations-map'), {ssr: false})

export default function LiveRoutePage() {
  const {locale} = useLocale()
  const labels = locale === 'es'
    ? {center: 'MAPA', map: 'Mapa de rutas', description: 'Paradas asignadas hoy. El tracking del camión con ETA llega con GPS nativo.', routes: 'Rutas'}
    : locale === 'fr'
      ? {center: 'CARTE', map: 'Carte des itinéraires', description: 'Arrêts assignés aujourd’hui. Le suivi camion + ETA arrivera avec le GPS natif.', routes: 'Itinéraires'}
      : {center: 'MAP', map: 'Route map', description: 'Assigned stops today. Truck tracking and ETA come later with native GPS.', routes: 'Routes'}
  const [error, setError] = useState('')
  const [routes, setRoutes] = useState<OperationsRoute[]>([])
  const [drivers, setDrivers] = useState<OperationsDriverLocation[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const membership = await currentMembership()
        const dashboard = await loadManagerDashboard({
          companyId: membership.company_id,
          branchId: membership.branch_id || null,
          routeDate: managerOperationalDate(),
        })
        setRoutes(dashboard.todayRoutes.map(route => ({
          id: route.id,
          origin_address: route.origin_address,
          origin_lat: route.origin_lat,
          origin_lng: route.origin_lng,
          destination_name: route.destination_name,
          destination_address: route.destination_address,
          destination_lat: route.destination_lat,
          destination_lng: route.destination_lng,
          status: route.status,
          driver_id: route.driver_id,
          position: route.position,
          order_number: route.order_number,
        })))
        let query = getSupabase()
          .from('driving_sessions')
          .select('id,driver_id,last_lat,last_lng,last_updated_at,status')
          .eq('company_id', membership.company_id)
          .in('status', ['active', 'paused'])
        if (membership.branch_id) query = query.eq('branch_id', membership.branch_id)
        const {data: sessions} = await query
        setDrivers((sessions || []).flatMap(session => (
          session.last_lat == null || session.last_lng == null ? [] : [{
            id: String(session.id),
            driver_id: String(session.driver_id),
            location: {lat: Number(session.last_lat), lng: Number(session.last_lng)},
            updatedAt: session.last_updated_at,
            status: 'on_route' as const,
          }]
        )))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load map.')
      }
    })()
  }, [])

  return (
    <ManagerShell active="map">
      <div className={`${styles.page} ${styles.managerMapPage}`}>
        <section className={styles.hero}>
          <div>
            <Link className={styles.back} href="/routes"><ArrowLeft size={16}/> {labels.routes}</Link>
            <p>{labels.center}</p>
            <h1>{labels.map}</h1>
            <span>{labels.description}</span>
          </div>
          <div className={styles.heroActions}>
            <Link href="/routes"><RouteIcon size={18}/> {labels.routes}</Link>
            <Link className={styles.primaryAction} href="/routes?new=1"><MapPinned size={18}/> {locale === 'es' ? 'Nueva ruta' : locale === 'fr' ? 'Nouvel itinéraire' : 'New route'}</Link>
          </div>
        </section>
        {error ? <p className={styles.error} role="status">{error}</p> : null}
        <OperationsMap routes={routes} driverLocations={drivers} locale={locale} interactive />
      </div>
    </ManagerShell>
  )
}
