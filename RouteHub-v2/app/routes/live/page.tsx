'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {ArrowLeft, ClipboardList, MapPinned, Radio, Route as RouteIcon} from 'lucide-react'
import {currentMembership} from '../../../lib/data'
import LiveRoute from '../live-route'
import NotificationBell from '../../notification-bell'
import {useLocale} from '../../../lib/use-preferences'
import styles from './live.module.css'

export default function LiveRoutePage() {
  const {locale}=useLocale()
  const labels=locale==='es'?{operations:'Operaciones en vivo',center:'CENTRO DE OPERACIONES',map:'Mapa en vivo',description:'Monitorea conductores activos, progreso de rutas y la próxima parada en tiempo real.',routes:'Rutas'}:locale==='fr'?{operations:'Opérations en direct',center:'CENTRE DES OPÉRATIONS',map:'Carte en direct',description:'Suivez les conducteurs actifs, la progression des itinéraires et le prochain arrêt en temps réel.',routes:'Itinéraires'}:{operations:'Live Operations',center:'OPERATIONS CENTER',map:'Live Map',description:'Monitor active drivers, route progress and the next stop in real time.',routes:'Routes'}
  const [membership,setMembership]=useState<{company_id:string;branch_id:string|null}|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{void currentMembership().then(value=>setMembership({company_id:value.company_id,branch_id:value.branch_id||null})).catch(cause=>setError(cause instanceof Error?cause.message:'Unable to load workspace.'))},[])
  return <main className={`app premium-shell ${styles.page}`}><header className={styles.topbar}><Link className={styles.brand} href="/manager" aria-label="RouteHub dashboard"><Image src="/routehub-regular-new.jpg" alt="" width={36} height={36} priority/><span>Route<em>Hub</em></span></Link><span className={styles.liveStatus}><Radio size={16}/> {labels.operations}</span><div className={styles.headerActions}><Link href="/routes/manage"><ClipboardList size={16}/>{labels.routes}</Link><NotificationBell /></div></header><section className={styles.hero}><div><Link className={styles.back} href="/routes"><ArrowLeft size={16}/> {labels.routes}</Link><p>{labels.center}</p><h1>{labels.map}</h1><span>{labels.description}</span></div><div className={styles.heroActions}><Link href="/routes"><RouteIcon size={18}/> {labels.routes}</Link><Link className={styles.primaryAction} href="/routes?new=1"><MapPinned size={18}/> {locale==='es'?'Nueva ruta':locale==='fr'?'Nouvel itinéraire':'New route'}</Link></div></section>{error&&<p className={styles.error} role="status">{error}</p>}{membership&&<LiveRoute companyId={membership.company_id} branchId={membership.branch_id} expanded overview/>}</main>
}
