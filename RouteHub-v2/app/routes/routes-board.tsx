'use client'

import {useEffect, useState} from 'react'
import dynamic from 'next/dynamic'
import {currentMembership} from '../../lib/data'
import {getSupabase} from '../../lib/supabase'
import type {OperationsDriverLocation, OperationsRoute} from '../operations-map'
import styles from './routes-board.module.css'

const OperationsMap = dynamic(() => import('../operations-map'), {ssr: false})

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
  return (
    <div className={styles.mapPane}>
      <OperationsMap routes={routes} driverLocations={drivers} locale={locale} interactive hideFooter />
    </div>
  )
}
