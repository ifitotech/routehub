'use client'

import {useEffect, useState} from 'react'
import dynamic from 'next/dynamic'
import {Map, X} from 'lucide-react'
import {currentMembership} from '../../lib/data'
import {getSupabase} from '../../lib/supabase'
import type {OperationsDriverLocation, OperationsRoute} from '../operations-map'
import styles from './routes-board.module.css'

const OperationsMap = dynamic(() => import('../operations-map'), {ssr: false})

export default function RoutesBoard({routes, locale}: {routes: OperationsRoute[]; locale: string}) {
  const [drivers, setDrivers] = useState<OperationsDriverLocation[]>([])
  const [expanded, setExpanded] = useState(false)
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
  const copy = locale==='es' ? {title:'Mapa de referencia',routes:'rutas',open:'Toca para ampliar el mapa',close:'Cerrar mapa'} : locale==='fr' ? {title:'Carte de référence',routes:'itinéraires',open:'Touchez pour agrandir la carte',close:'Fermer la carte'} : {title:'Reference map',routes:'routes',open:'Tap to expand map',close:'Close map'}
  const openMap = () => setExpanded(true)
  return <>
    <div className={styles.mapPane} role="button" tabIndex={0} aria-label={copy.open} onClick={openMap} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMap() } }}>
      <header className={styles.mapHeading}><span><Map size={16}/>{locale==='es'?'Mapa de referencia':locale==='fr'?'Carte de référence':'Reference map'}</span><small>{routes.length} {locale==='es'?'rutas':locale==='fr'?'itinéraires':'routes'}</small></header>
      <OperationsMap routes={routes} driverLocations={drivers} locale={locale} interactive={false} hideFooter />
    </div>
    {expanded && <div className={styles.mapModal} role="dialog" aria-modal="true" aria-label={copy.title} onClick={() => setExpanded(false)}>
      <section className={styles.mapModalCard} onClick={event => event.stopPropagation()}>
        <header><span><Map size={18}/>{copy.title}</span><button type="button" onClick={() => setExpanded(false)} aria-label={copy.close}><X size={18}/></button></header>
        <OperationsMap routes={routes} driverLocations={drivers} locale={locale} interactive hideFooter />
      </section>
    </div>}
  </>
}
