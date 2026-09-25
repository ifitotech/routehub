'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import {ChevronRight} from 'lucide-react'
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
  const lastServiceValue = serviceDate
    ? `${serviceDate}${lastService?.odometer != null ? `, ${lastService.odometer.toLocaleString(locale === 'es' ? 'es-US' : locale === 'fr' ? 'fr-FR' : 'en-US')} mi` : ''}`
    : null

  return (
    <Link href="/manager/truck" className={styles.bar}>
      <VanIllustration />
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.text}>
        <span className={styles.titleRow}>
          <strong>{locale === 'es' ? 'Camión' : locale === 'fr' ? 'Camion' : 'Truck'} · {label}</strong>
          {/* The query above only ever loads a truck with active = true. */}
          <span className={styles.active}><i />{locale === 'es' ? 'Activo' : locale === 'fr' ? 'Actif' : 'Active'}</span>
        </span>
        {(odometer || lastServiceValue) && (
          <small>
            {odometer && <b>{odometer}</b>}
            {odometer && lastServiceValue && <span className={styles.sep}>|</span>}
            {lastServiceValue && <>{locale === 'es' ? 'Último servicio' : locale === 'fr' ? 'Dernier entretien' : 'Last service'} <b>{lastServiceValue}</b></>}
          </small>
        )}
      </span>
      <span className={styles.view}>{locale === 'es' ? 'Ver' : locale === 'fr' ? 'Voir' : 'View'}<ChevronRight size={15} /></span>
    </Link>
  )
}

function VanIllustration() {
  return (
    <svg className={styles.van} viewBox="0 0 120 52" aria-hidden="true">
      <ellipse cx="60" cy="48" rx="54" ry="3" fill="rgba(0,0,0,.35)" />
      <path d="M8 41V29c0-3 1.4-5.2 3.6-6.8L22.5 12c2-1.9 4.4-3 7.3-3H106c3.3 0 6 2.7 6 6v26z" fill="#eef2f7" />
      <path d="M8 34h104v7H8z" fill="#cfd8e3" />
      <path d="M13.5 24.5 23.8 14.2c.8-.8 1.9-1.2 3-1.2H34v11.5z" fill="#1b2a40" />
      <rect x="37" y="13" width="15" height="11.5" rx="1.5" fill="#1b2a40" />
      <path d="M54.5 11v28M88 11v28" stroke="#c3ccd8" strokeWidth="1" />
      <rect x="6" y="36" width="10" height="4" rx="1.5" fill="#9aa7b8" />
      <circle cx="28" cy="41.5" r="7" fill="#111c2b" />
      <circle cx="28" cy="41.5" r="3" fill="#9aa7b8" />
      <circle cx="94" cy="41.5" r="7" fill="#111c2b" />
      <circle cx="94" cy="41.5" r="3" fill="#9aa7b8" />
    </svg>
  )
}
