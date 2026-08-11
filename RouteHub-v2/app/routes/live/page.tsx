'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import {Radio} from 'lucide-react'
import {currentMembership} from '../../../lib/data'
import LiveRoute from '../live-route'
import NotificationBell from '../../notification-bell'

export default function LiveRoutePage() {
  const [membership,setMembership]=useState<{company_id:string;branch_id:string|null}|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{void currentMembership().then(value=>setMembership({company_id:value.company_id,branch_id:value.branch_id||null})).catch(cause=>setError(cause instanceof Error?cause.message:'Unable to load workspace.'))},[])
  return <main className="app premium-shell"><header className="topbar"><Link className="brand" href="/routes" aria-label="RouteHub routes">ROUTEHUB</Link><span className="live-page-title"><Radio size={18}/> Live Route</span><NotificationBell /></header>{error&&<p className="muted" role="status">{error}</p>}{membership&&<LiveRoute companyId={membership.company_id} branchId={membership.branch_id} expanded/>}</main>
}
