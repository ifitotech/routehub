'use client'
import {useState} from 'react'
import Link from 'next/link'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {startDrivingDay,endDrivingDay} from '../../../lib/driver-v3/actions'

export default function DriverV3DrivingDay(){
 const {driverId,companyId,branchId,drivingSession,loading,error,refresh}=useDriverData()
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
 const toggle=async()=>{if(busy)return;setBusy(true);setMessage('');try{if(drivingSession) await endDrivingDay({driverId,sessionId:drivingSession.id}); else await startDrivingDay({driverId,companyId,branchId});await refresh();setMessage(drivingSession?'Driving day ended.':'Driving day started.')}catch(e){setMessage(e instanceof Error?e.message:'Unable to update driving day.')}finally{setBusy(false)}}
 return <DriverV3Shell active="more"><Link href="/driver/more" className="muted">‹ More</Link><p className="eyebrow">WORK</p><h1 className="title">Driving Day</h1>{loading?<section className="card"><p>Loading driving day…</p></section>:error?<section className="card"><p role="alert">{error}</p></section>:<section className="card"><p className="eyebrow">STATUS</p><h2>{drivingSession?'ACTIVE':'NOT STARTED'}</h2>{drivingSession&&<p className="muted">Started {new Date(drivingSession.started_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</p>}<button className={drivingSession?'danger':'primary'} disabled={busy||!driverId||!companyId} onClick={()=>void toggle()}>{busy?'Updating…':drivingSession?'END DRIVING DAY':'START DRIVING DAY'}</button>{message&&<p role="status" className="muted">{message}</p>}</section>}</DriverV3Shell>
}
