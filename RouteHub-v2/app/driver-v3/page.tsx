'use client'

import Link from 'next/link'
import {ChevronRight, Map, MapPin, Package, TriangleAlert} from 'lucide-react'
import {useState} from 'react'
import DriverV3Shell from '../../components/driver-v3/DriverV3Shell'
import {operationalDate} from '../../lib/driver-queue'
import {markArrived, startRoute} from '../../lib/driver-v3/actions'
import {useDriverData} from '../../lib/driver-v3/use-driver-data'
import styles from './today.module.css'

export default function DriverV3Page() {
  const {loading,error,snapshot,driverId,refresh,drivingSession}=useDriverData()
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const operation=snapshot?.currentOperation
  const route=operation?.route as any
  const kind=operation?.kind==='branch'?'return':operation?.kind
  const nextRoute=snapshot?.queue.upcoming?.[0] as any
  const total=operation?.total??0
  const completed=operation?.completed??0
  const remaining=Math.max(0,total-completed)
  const progress=total>0?Math.min(100,Math.max(0,(completed/total)*100)):0
  const progressNodes=total>0&&total<=7?Array.from({length:total},(_,index)=>index):null

  const operate=async()=>{
    if(!route||busy)return
    setBusy(true)
    setMessage('')
    try{
      const context={routeId:route.id,driverId,companyId:route.company_id}
      if(route.status!=='active')await startRoute(context,operationalDate())
      else if(!route.arrived_at)await markArrived(context)
      await refresh()
      setMessage(route.status!=='active'?'Route started.':'Arrival recorded.')
    }catch(error){
      setMessage(error instanceof Error?error.message:'Unable to update operation.')
    }finally{
      setBusy(false)
    }
  }

  const primaryLabel=route?.status!=='active'?'START ROUTE':!route?.arrived_at?'ARRIVED AT STOP':'OPEN STOP'

  return <DriverV3Shell active="today" headerStatus={`Driving Day · ${drivingSession?'Active':'Inactive'}`}>
    <div className={styles.page}>
      {!drivingSession&&<Link className={styles.startDay} href="/driver-v3/driving-day">START DRIVING DAY</Link>}
      {loading?<TodayLoading/>:error?<section className={styles.stateCard}>
        <h1>Couldn&apos;t load your route.</h1><p>Try again when your connection is available.</p>
        <button type="button" onClick={()=>void refresh()}>TRY AGAIN</button>
      </section>:operation&&route?<>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <span className={`${styles.typeBadge} ${styles[kind||'return']}`}><Package/>{(kind||'return').toUpperCase()}</span>
            <span className={styles.stopCount}>STOP <strong>{route.position||completed+1}</strong> OF {total}</span>
          </div>
          <div className={styles.destination}>
            <div><h1>{route.destination_name||route.destination_address||'Current stop'}</h1>{route.destination_name&&route.destination_address&&<p>{route.destination_address}</p>}{route.order_number&&<span className={styles.order}>PO {route.order_number}</span>}</div>
            <span className={`${styles.operationIcon} ${styles[kind||'return']}`} aria-hidden="true"><Package/></span>
          </div>
          <div className={styles.divider}/>
          {route.arrived_at?<Link className={styles.primary} href="/driver-v3/stop"><MapPin/>OPEN STOP</Link>:<button className={styles.primary} disabled={busy} onClick={()=>void operate()}><MapPin/>{busy?'UPDATING…':primaryLabel}</button>}
          <div className={styles.secondaryActions}><Link className={styles.mapAction} href="/driver-v3/map"><Map/>Open Maps</Link><Link className={styles.issueAction} href="/driver-v3/issue"><TriangleAlert/>Issue</Link></div>
          {message&&<p className={styles.feedback} role="status">{message}</p>}
        </section>
        <section className={styles.progressCard} aria-label={`${completed} completed, ${remaining} remaining`}>
          <div><strong>{completed}</strong><span>Completed</span></div>
          {progressNodes?<div className={styles.progressDots}>{progressNodes.map(index=><i key={index} className={index<completed?styles.done:index===completed?styles.current:styles.upcoming}/>)}</div>:<div className={styles.progressTrack}><span style={{width:`${progress}%`}}/><i style={{left:`clamp(8px, ${progress}%, calc(100% - 8px))`}}/></div>}
          <div><strong>{remaining}</strong><span>Remaining</span></div>
        </section>
        {nextRoute?<Link className={styles.nextCard} href={`/driver-v3/stop?id=${encodeURIComponent(nextRoute.id)}`}><div><span>NEXT STOP</span><strong>{nextRoute.destination_name||nextRoute.destination_address||'Next stop'}</strong>{nextRoute.destination_name&&nextRoute.destination_address&&<p>{nextRoute.destination_address}</p>}</div><i><ChevronRight/></i></Link>:<section className={styles.nextCard}><div><span>NEXT STOP</span><strong>No more required stops</strong></div></section>}
      </>:<section className={styles.stateCard}><Package/><h1>No stops right now.</h1><p>Your assigned work will appear here.</p></section>}
    </div>
  </DriverV3Shell>
}

function TodayLoading(){return <div className={styles.loading} aria-label="Loading your route"><div className={styles.loadingHero}/><div className={styles.loadingProgress}/><div className={styles.loadingNext}/></div>}
