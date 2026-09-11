'use client'

import {useEffect, useState} from 'react'
import {currentMembership} from '../../lib/data'
import {getSupabase} from '../../lib/supabase'
import type {OperationsDriverLocation, OperationsRoute} from '../operations-map'
import CompactMap from '../manager/compact-map'
import styles from './routes-board.module.css'

export default function RoutesBoard({routes, locale}: {routes: OperationsRoute[]; locale: string}) {
  const [drivers, setDrivers] = useState<OperationsDriverLocation[]>([])
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
    <div className={styles.mapPane}>
      <CompactMap
        routes={routes}
        driverLocations={drivers}
        locale={locale}
        hideFooter
        expandLabel={copy.expand}
        collapseLabel={copy.collapse}
      />
    </div>
  )
}
