'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {ArrowLeft, Radio} from 'lucide-react'
import {currentMembership} from '../../../lib/data'
import LiveRoute from '../live-route'

export default function LiveRoutePage() {
  const [membership,setMembership]=useState<{company_id:string;branch_id:string|null}|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{void currentMembership().then(value=>setMembership({company_id:value.company_id,branch_id:value.branch_id||null})).catch(cause=>setError(cause instanceof Error?cause.message:'Unable to load workspace.'))},[])
  return <main className="app premium-shell"><header className="topbar"><Link className="secondary" href="/routes"><ArrowLeft size={17}/>Routes</Link><span className="brand"><Radio size={18}/> Live Route</span></header>{error&&<p className="muted" role="status">{error}</p>}{membership&&<LiveRoute companyId={membership.company_id} branchId={membership.branch_id} expanded/>}</main>
}
