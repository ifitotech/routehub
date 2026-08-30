'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import {ChevronRight, Map, MapPin, Package, TriangleAlert} from 'lucide-react'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
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

const LiveRouteMap = dynamic(() => import('../live-route-map'), {ssr: false})

export default function DriverV3Page() {
  const {t}=useLocale()
  const router=useRouter()
  const {loading,error,snapshot,driverId,companyId,branchId,refresh,drivingSession,routes}=useDriverData()
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const operation=snapshot?.currentOperation
  const route=operation?.route as any
  const kind=operation?.kind==='branch'?'return':operation?.kind
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
      if(!starting) router.push(`/driver/stop?id=${encodeURIComponent(route.id)}`)
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
  return <DriverV3Shell active="today" headerStatus={drivingSession?t.drvDayActive:t.drvDayInactive}>
    <div className={styles.page}>
      {!drivingSession&&<Link className={styles.startDay} href="/driver/driving-day">{t.drvStartDrivingDay}</Link>}
      {loading?<TodayLoading label={t.drvLoadingRoute}/>:error?<section className={styles.stateCard}>
        <h1>{t.drvCouldntLoad}</h1><p>{t.drvConnRetry}</p>
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
          <div style={{height:160,borderRadius:14,overflow:'hidden',marginBottom:12}}>
            <LiveRouteMap
              destinationAddress={route.destination_address}
              destinationCoordinate={route.destination_lat!=null&&route.destination_lng!=null?{lat:Number(route.destination_lat),lng:Number(route.destination_lng)}:null}
              driverLocation={drivingSession?.last_lat!=null&&drivingSession?.last_lng!=null?{lat:Number(drivingSession.last_lat),lng:Number(drivingSession.last_lng)}:null}
              driverUpdatedAt={drivingSession?.last_updated_at||null}
              title={t.drvCurrentStop}
              showHeader={false}
              interactive
            />
          </div>
          {route.arrived_at?<Link className={styles.primary} href={`/driver/stop?id=${encodeURIComponent(route.id)}`}><MapPin/>{t.drvContinue}</Link>:<button className={styles.primary} disabled={busy} onClick={()=>void operate()}><MapPin/>{busy?t.drvBusy:primaryLabel}</button>}
          <div className={styles.secondaryActions}><button type="button" className={styles.mapAction} onClick={openMaps}><Map/>{t.drvOpenMaps}</button><Link className={styles.issueAction} href="/driver/issue"><TriangleAlert/>{t.drvIssue}</Link></div>
          {message&&<p className={styles.feedback} role="status">{message}</p>}
        </section>
        <section className={styles.progressCard} aria-label={`${completed} completed, ${remaining} remaining`}>
          <div><strong>{completed}</strong><span>{t.drvDoneWord}</span></div>
          {progressNodes?<div className={styles.progressDots}>{progressNodes.map(index=><i key={index} className={index<completed?styles.done:index===completed?styles.current:styles.upcoming}/>)}</div>:<div className={styles.progressTrack}><span style={{width:`${progress}%`}}/><i style={{left:`clamp(8px, ${progress}%, calc(100% - 8px))`}}/></div>}
          <div><strong>{remaining}</strong><span>{t.drvLeftWord}</span></div>
        </section>
        <Link className={styles.nextCard} href={`/driver/stop?id=${encodeURIComponent(route.id)}`}><div><span>{t.drvStopDetails}</span><strong>{route.order_number?`PO ${route.order_number}`:t.drvStopDetails}</strong></div><i><ChevronRight/></i></Link>
        <section className={styles.progressCard} style={{display:'block',marginTop:12}}>
          <p className="eyebrow" style={{marginBottom:8}}>{t.drvMyRoute}</p>
          {routes.filter((item:any)=>(item.route_date||'').slice(0,10)===operationalDate()).sort((a:any,b:any)=>(a.position||0)-(b.position||0)).map((item:any)=>(
            <Link key={item.id} href={`/driver/stop?id=${encodeURIComponent(item.id)}`} className={styles.nextCard} style={{margin:'0 0 8px',textDecoration:'none'}}>
              <div>
                <span>{item.status==='completed'?t.drvCompletedTag:item.id===route.id?t.drvCurrentStop:t.drvNextStop}{item.order_number?` · PO ${item.order_number}`:''}</span>
                <strong>{item.destination_name||item.destination_address||t.drvCurrentStopName}</strong>
              </div>
              <i><ChevronRight/></i>
            </Link>
          ))}
        </section>
      </>:<section className={styles.stateCard}><Package/><h1>{t.drvNoStops}</h1><p>{t.drvAssignedWork}</p></section>}
    </div>
  </DriverV3Shell>
}

function TodayLoading({label}:{label:string}) {
  return (
    <div className={styles.loading} aria-label={label}>
      <div className={styles.loadingHero}/>
      <div className={styles.loadingProgress}/>
      <div className={styles.loadingNext}/>
    </div>
  )
}
