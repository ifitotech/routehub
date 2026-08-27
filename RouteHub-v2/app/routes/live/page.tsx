'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {ArrowLeft, Radio} from 'lucide-react'
import {currentMembership} from '../../../lib/data'
import LiveRoute from '../live-route'
import NotificationBell from '../../notification-bell'
import {useLocale} from '../../../lib/use-preferences'

export default function LiveRoutePage() {
  const {locale}=useLocale()
  const labels=locale==='es'?{operations:'Operaciones en vivo',center:'CENTRO DE OPERACIONES',map:'Mapa en vivo',description:'Monitorea conductores activos, progreso de rutas y la próxima parada en tiempo real.',routes:'Rutas'}:locale==='fr'?{operations:'Opérations en direct',center:'CENTRE DES OPÉRATIONS',map:'Carte en direct',description:'Suivez les conducteurs actifs, la progression des itinéraires et le prochain arrêt en temps réel.',routes:'Itinéraires'}:{operations:'Live Operations',center:'OPERATIONS CENTER',map:'Live Map',description:'Monitor active drivers, route progress and the next stop in real time.',routes:'Routes'}
  const [membership,setMembership]=useState<{company_id:string;branch_id:string|null}|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{void currentMembership().then(value=>setMembership({company_id:value.company_id,branch_id:value.branch_id||null})).catch(cause=>setError(cause instanceof Error?cause.message:'Unable to load workspace.'))},[])
  return <main className="app premium-shell"><header className="topbar"><Link className="brand" href="/manager" aria-label="RouteHub dashboard"><Image src="/routehub-regular-new.jpg" alt="" width={32} height={32} priority/><span>Route<em>Hub</em></span></Link><span className="live-page-title"><Radio size={18}/> {labels.operations}</span><NotificationBell /></header><Link className="back-link" href="/routes"><ArrowLeft size={16}/> {labels.routes}</Link><section className="live-page-intro"><p className="eyebrow">{labels.center}</p><h1>{labels.map}</h1><p>{labels.description}</p></section>{error&&<p className="muted" role="status">{error}</p>}{membership&&<LiveRoute companyId={membership.company_id} branchId={membership.branch_id} expanded/>}</main>
}
