'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import {Map, MapPin, Package, TriangleAlert} from 'lucide-react'
import {useState} from 'react'
import DriverV3Shell from '../../components/driver-v3/DriverV3Shell'
import {operationalDate} from '../../lib/driver-queue'
import {completeDelivery, completePickupWithEvidence, completeReturn, markArrived, startRoute} from '../../lib/driver-v3/actions'
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
  const {loading,error,snapshot,driverId,companyId,branchId,refresh,drivingSession,liveFix}=useDriverData()
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const operation=snapshot?.currentOperation
  const route=operation?.route as any
  const kind=operation?.kind==='branch'?'return':operation?.kind
  const started=['active','paused'].includes(String(route?.status||''))

  const openMaps=()=>{
    if(!route)return
    const url=openNavigation({
      address:route.destination_address,
      coordinate:route.destination_lat!=null&&route.destination_lng!=null?{lat:Number(route.destination_lat),lng:Number(route.destination_lng)}:null,
      label:route.destination_name,
    })
    if(url)window.location.assign(url)
  }

  const startCurrent=async()=>{
    if(!route||busy)return
    setBusy(true)
    setMessage('')
    try{
      const context={routeId:route.id,driverId,companyId:route.company_id}
      await startRoute(context,operationalDate())
      if(!drivingSession){
        try{await startTemporaryRouteSession({companyId:companyId||route.company_id,branchId,driverId,routeId:route.id})}catch{}
      }
      if(drivingSession){
        try{
          const location=await getCurrentLocation({maximumAge:0})
          await updateDrivingLocation(drivingSession.id,driverId,location)
        }catch{}
      }
      await refresh()
      openMaps()
    }catch(error){
      setMessage(error instanceof Error?error.message:t.drvOpFailed)
    }finally{
      setBusy(false)
    }
  }

  const completeCurrent=async()=>{
    if(!route||busy||!driverId)return
    setBusy(true)
    setMessage('')
    try{
      const context={routeId:route.id,driverId,companyId:route.company_id}
      if(!['active','paused'].includes(String(route.status||''))){
        await startRoute(context,operationalDate())
      }
      try{await markArrived(context)}catch{}
      let location
      try{location=await getCurrentLocation({maximumAge:60_000})}catch{}
      if(kind==='pickup')await completePickupWithEvidence(context)
      else if(kind==='return')await completeReturn(context,{location})
      else await completeDelivery(context)
      try{window.sessionStorage.setItem('routehub:last-completed-id',route.id)}catch{}
      await refresh()
    }catch(error){
      setMessage(error instanceof Error?error.message:t.drvOpFailed)
    }finally{
      setBusy(false)
    }
  }

  const completeLabel=kind==='pickup'?t.drvCompletePickup:kind==='return'?t.drvCompleteReturn:t.drvCompleteDelivery

  return <DriverV3Shell active="today" headerStatus={drivingSession?t.drvDayActive:t.drvDayInactive}>
    <div className={styles.page}>
      {!drivingSession&&<Link className={styles.startDay} href="/driver/driving-day">{t.drvStartDrivingDay}</Link>}
      {loading?<TodayLoading label={t.drvLoadingRoute}/>:error?<section className={styles.stateCard}>
        <h1>{t.drvCouldntLoad}</h1><p>{t.drvConnRetry}</p>
        <button type="button" onClick={()=>void refresh()}>{t.drvTryAgain}</button>
      </section>:operation&&route?<>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <span className={`${styles.typeBadge} ${styles[kind||'return']}`}><Package/>{kind==='pickup'?t.drvPickup||'PICKUP':kind==='delivery'?t.drvDelivery||'DELIVERY':t.drvReturn||'RETURN'}</span>
          </div>
          <div className={styles.destination}>
            <div>
              <h1>{route.destination_name||route.destination_address||t.drvCurrentStopName}</h1>
              {route.destination_address&&<p>{route.destination_address}</p>}
              {route.order_number&&<span className={styles.order}>PO {route.order_number}</span>}
            </div>
            <span className={`${styles.operationIcon} ${styles[kind||'return']}`} aria-hidden="true"><Package/></span>
          </div>
          <div className={styles.divider}/>
          <button type="button" onClick={openMaps} aria-label={t.drvOpenMaps} style={{display:'block',width:'100%',height:160,border:0,padding:0,margin:'0 0 12px',borderRadius:14,overflow:'hidden',background:'#e8eef4'}}>
            <div style={{height:'100%',pointerEvents:'none'}}>
            <LiveRouteMap
              destinationAddress={route.destination_address}
              destinationCoordinate={route.destination_lat!=null&&route.destination_lng!=null?{lat:Number(route.destination_lat),lng:Number(route.destination_lng)}:null}
              driverLocation={liveFix?{lat:liveFix.lat,lng:liveFix.lng}:drivingSession?.last_lat!=null&&drivingSession?.last_lng!=null?{lat:Number(drivingSession.last_lat),lng:Number(drivingSession.last_lng)}:null}
              driverUpdatedAt={liveFix?.at||drivingSession?.last_updated_at||null}
              title={t.drvCurrentStop}
              showHeader={false}
              showLocationUpdated={false}
              interactive={false}
              useDriverAsOrigin
            />
            </div>
          </button>
          {started?(
            <button className={styles.primary} style={{background:'#16B96B'}} disabled={busy} onClick={()=>void completeCurrent()}>
              <MapPin/>{busy?t.drvBusy:completeLabel}
            </button>
          ):(
            <button className={styles.primary} style={{background:'#16B96B'}} disabled={busy} onClick={()=>void startCurrent()}>
              <MapPin/>{busy?t.drvBusy:t.drvStartRoute}
            </button>
          )}
          <div className={styles.secondaryActions}>
            <button type="button" className={styles.mapAction} onClick={openMaps}><Map/>{t.drvOpenMaps}</button>
            <Link className={styles.issueAction} href="/driver/issue"><TriangleAlert/>{t.drvIssue}</Link>
          </div>
          {message&&<p className={`${styles.feedback}${/could not|failed|pending|error|no se pudo|imposible/i.test(message)?` ${styles.feedbackError}`:''}`} role="status">{message}</p>}
        </section>
      </>:<section className={styles.stateCard}><Package/><h1>{t.drvNoStops}</h1><p>{t.drvAssignedWork}</p></section>}
    </div>
  </DriverV3Shell>
}

function TodayLoading({label}:{label:string}) {
  return (
    <div className={styles.loading} aria-label={label}>
      <div className={styles.loadingHero}/>
    </div>
  )
}
