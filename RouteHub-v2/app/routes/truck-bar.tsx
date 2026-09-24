'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import {ChevronRight, Truck as TruckIcon} from 'lucide-react'
import {currentMembership} from '../../lib/data'
import {getSupabase} from '../../lib/supabase'
import styles from './truck-bar.module.css'

type TruckRow = {name: string; make: string | null; model: string | null; current_odometer: number | null}
type LastService = {serviced_at: string; odometer: number | null} | null

// A fixed, single-line strip at the bottom of the Dashboard - Truck data is
// real (current_odometer, most recent truck_maintenance_logs row) or the
// bar doesn't render at all. No invented "next service due": that field
// doesn't exist in the schema, only a service history.
export default function TruckBar({locale}: {locale: string}) {
  const [truck, setTruck] = useState<TruckRow | null>(null)
  const [lastService, setLastService] = useState<LastService>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const membership = await currentMembership()
        const client = getSupabase()
        let branchId = membership.branch_id || ''
        if (!branchId) {
          const {data: branch} = await client.from('branches').select('id').eq('company_id', membership.company_id).order('name').limit(1).maybeSingle()
          branchId = String(branch?.id || '')
        }
        if (!branchId) { if (active) setLoaded(true); return }
        const {data: truckRow} = await client
          .from('trucks')
          .select('id,name,make,model,current_odometer')
          .eq('company_id', membership.company_id)
          .eq('branch_id', branchId)
          .eq('active', true)
          .order('updated_at', {ascending: false})
          .limit(1)
          .maybeSingle()
        if (!active) return
        if (!truckRow) { setLoaded(true); return }
        setTruck(truckRow)
        const {data: serviceRow} = await client
          .from('truck_maintenance_logs')
          .select('serviced_at,odometer')
          .eq('truck_id', truckRow.id)
          .order('serviced_at', {ascending: false})
          .limit(1)
          .maybeSingle()
        if (active) { setLastService(serviceRow || null); setLoaded(true) }
      } catch {
        if (active) setLoaded(true)
      }
    })()
    return () => { active = false }
  }, [])

  if (!loaded || !truck) return null

  const label = [truck.make, truck.model].filter(Boolean).join(' ') || truck.name
  const odometer = truck.current_odometer != null ? `${truck.current_odometer.toLocaleString(locale === 'es' ? 'es-US' : locale === 'fr' ? 'fr-FR' : 'en-US')} mi` : null
  const serviceDate = lastService?.serviced_at
    ? new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : locale === 'fr' ? 'fr-FR' : 'en-US', {month: 'short', day: 'numeric', year: 'numeric'}).format(new Date(lastService.serviced_at))
    : null
  const lastServiceLabel = serviceDate
    ? (locale === 'es' ? `último servicio ${serviceDate}${lastService?.odometer != null ? `, ${lastService.odometer.toLocaleString()} mi` : ''}` : locale === 'fr' ? `dernier entretien ${serviceDate}${lastService?.odometer != null ? `, ${lastService.odometer.toLocaleString()} mi` : ''}` : `last service ${serviceDate}${lastService?.odometer != null ? `, ${lastService.odometer.toLocaleString()} mi` : ''}`)
    : null

  return (
    <Link href="/manager/truck" className={styles.bar}>
      <span className={styles.icon}><TruckIcon size={18} /></span>
      <span className={styles.text}>
        <strong>{locale === 'es' ? 'Camión' : locale === 'fr' ? 'Camion' : 'Truck'} · {label}</strong>
        {(odometer || lastServiceLabel) && <small>{[odometer, lastServiceLabel].filter(Boolean).join(' · ')}</small>}
      </span>
      <span className={styles.view}>{locale === 'es' ? 'Ver' : locale === 'fr' ? 'Voir' : 'View'}<ChevronRight size={15} /></span>
    </Link>
  )
}
