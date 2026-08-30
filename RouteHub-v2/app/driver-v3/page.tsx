'use client'

import Link from 'next/link'
import {ChevronRight, Map, MapPin, Package, TriangleAlert} from 'lucide-react'
import {useState} from 'react'
import DriverV3Shell from '../../components/driver-v3/DriverV3Shell'
import {operationalDate} from '../../lib/driver-queue'
import {markArrived, startRoute} from '../../lib/driver-v3/actions'
import {startTemporaryRouteSession} from '../../lib/driving-session'
import {useDriverData} from '../../lib/driver-v3/use-driver-data'
import {openNavigation} from '../../lib/maps/external-navigation'
import {getCurrentLocation} from '../../lib/location'
import {updateDrivingLocation} from '../../lib/driving-session'
import {useLocale} from '../../lib/use-preferences'
import styles from './today.module.css'

export default function DriverV3Page() {
  const {t}=useLocale()
  const {loading,error,snapshot,driverId,companyId,branchId,refresh,drivingSession}=useDriverData()
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
    const starting=route.status!=='active'
    try{
      const context={routeId:route.id,driverId,companyId:route.company_id}
      if(starting){
        await startRoute(context,operationalDate())
        if(!drivingSession){
          try{await startTemporaryRouteSession({companyId:companyId||route.company_id,branchId,driverId,routeId:route.id})}catch{}
        }
      }
      else if(!route.arrived_at)await markArrived(context)
      if(drivingSession){
        try{
          const location=await getCurrentLocation({maximumAge:0})
          await updateDrivingLocation(drivingSession.id,driverId,location)
        }catch{}
      }
      await refresh()
      setMessage(starting?t.drvStartRoute:t.drvArrivedOk)
    }catch(error){
      setMessage(error instanceof Error?error.message:t.drvOpFailed)
    }finally{
      setBusy(false)
    }
  }

  const openMaps=()=>{
    if(!route)return
    const url=openNavigation({
      address:route.destination_address,
      coordinate:route.destination_lat!=null&&route.destination_lng!=null?{lat:Number(route.destination_lat),lng:Number(route.destination_lng)}:null,
      label:route.destination_name,
    })
    if(url){
      const opened=window.open(url,'_blank','noopener,noreferrer')
      if(!opened)window.location.assign(url)
    }
  }

  const primaryLabel=route?.status!=='active'?t.drvStartRoute:!route?.arrived_at?t.drvArrived:t.drvContinue
  const nextKind=((nextRoute?.mission_type||'')+'').toLowerCase()
  const nextKindLabel=nextKind==='pickup'?t.drvPickup:nextKind==='branch'||nextKind==='return'?t.drvReturn:nextKind?t.drvDelivery:''

  return <DriverV3Shell active="today" headerStatus={drivingSession?t.drvDayActive:t.drvDayInactive}>
    <div className={styles.page}>
      {!drivingSession&&<Link className={styles.startDay} href="/driver/driving-day">{t.drvStartDrivingDay}</Link>}
      {loading?<TodayLoading/>:error?<section className={styles.stateCard}>
        <h1>{t.drvCouldntLoad}</h1><p>Try again when your connection is available.</p>
        <button type="button" onClick={()=>void refresh()}>{t.drvTryAgain}</button>
      </section>:operation&&route?<>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <span className={`${styles.typeBadge} ${styles[kind||'return']}`}><Package/>{kind==='pickup'?t.drvPickup:kind==='delivery'?t.drvDelivery:t.drvReturn}</span>
            <span className={styles.stopCount}>{t.drvStop} <strong>{route.position||completed+1}</strong> {t.drvOf} {total}</span>
          </div>
          <div className={styles.destination}>
            <div><h1>{route.destination_name||route.destination_address||t.drvCurrentStopName}</h1>{route.destination_name&&route.destination_address&&<p>{route.destination_address}</p>}{route.order_number&&<span className={styles.order}>PO {route.order_number}</span>}</div>
            <span className={`${styles.operationIcon} ${styles[kind||'return']}`} aria-hidden="true"><Package/></span>
          </div>
          <div className={styles.divider}/>
          {route.arrived_at?<Link className={styles.primary} href="/driver/stop"><MapPin/>CONTINUE ROUTE</Link>:<button className={styles.primary} disabled={busy} onClick={()=>void operate()}><MapPin/>{busy?'UPDATING…':primaryLabel}</button>}
          <div className={styles.secondaryActions}><button type="button" className={styles.mapAction} onClick={openMaps}><Map/>{t.drvOpenMaps}</button><Link className={styles.issueAction} href="/driver/issue"><TriangleAlert/>{t.drvIssue}</Link></div>
          {message&&<p className={styles.feedback} role="status">{message}</p>}
        </section>
        <section className={styles.progressCard} aria-label={`${completed} completed, ${remaining} remaining`}>
          <div><strong>{completed}</strong><span>{t.drvDoneWord}</span></div>
          {progressNodes?<div className={styles.progressDots}>{progressNodes.map(index=><i key={index} className={index<completed?styles.done:index===completed?styles.current:styles.upcoming}/>)}</div>:<div className={styles.progressTrack}><span style={{width:`${progress}%`}}/><i style={{left:`clamp(8px, ${progress}%, calc(100% - 8px))`}}/></div>}
          <div><strong>{remaining}</strong><span>{t.drvLeftWord}</span></div>
        </section>
        {nextRoute?<Link className={styles.nextCard} href={`/driver/stop?id=${encodeURIComponent(nextRoute.id)}`}><div><span>{t.drvNextStop}{nextKindLabel?` · ${nextKindLabel}`:''}</span><strong>{nextRoute.destination_name||nextRoute.destination_address||'Next stop'}</strong>{nextRoute.destination_name&&nextRoute.destination_address&&<p>{nextRoute.destination_address}</p>}{nextRoute.order_number?<p>PO {nextRoute.order_number}</p>:null}</div><i><ChevronRight/></i></Link>:<section className={styles.nextCard}><div><span>{t.drvNextStop}</span><strong>{t.drvNoMoreStops}</strong></div></section>}
      </>:<section className={styles.stateCard}><Package/><h1>{t.drvNoStops}</h1><p>{t.drvAssignedWork}</p></section>}
    </div>
  </DriverV3Shell>
}

function TodayLoading(){return <div className={styles.loading} aria-label={t.drvLoadingRoute}><div className={styles.loadingHero}/><div className={styles.loadingProgress}/><div className={styles.loadingNext}/></div>}
