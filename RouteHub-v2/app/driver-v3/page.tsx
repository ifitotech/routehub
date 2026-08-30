'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import {Map, MapPin, Package, TriangleAlert} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import DriverV3Shell from '../../components/driver-v3/DriverV3Shell'
import {operationalDate} from '../../lib/driver-queue'
import {completeDeliveryWithRecipient, completePickupWithEvidence, completeReturn, markArrived, saveStopSignature, startRoute, uploadStopPhoto} from '../../lib/driver-v3/actions'
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
  const [sheet,setSheet]=useState<null | 'pickup' | 'delivery'>(null)
  const [recipient,setRecipient]=useState('')
  const [photo,setPhoto]=useState<File | null>(null)
  const [signed,setSigned]=useState(false)
  const canvas=useRef<HTMLCanvasElement>(null)
  const operation=snapshot?.currentOperation
  const route=operation?.route as any
  const kind=operation?.kind==='branch'?'return':operation?.kind
  useEffect(()=>{
    if(!sheet)return
    const html=document.documentElement
    const body=document.body
    const prevHtml=html.style.overflow
    const prevBody=body.style.overflow
    html.style.overflow='hidden'
    body.style.overflow='hidden'
    return()=>{html.style.overflow=prevHtml;body.style.overflow=prevBody}
  },[sheet])
  const started=['active','paused'].includes(String(route?.status||''))
  const arrived=Boolean(route?.arrived_at)
  const hasPod=Boolean(route?.completion_photo_path || route?.customer_signature_path || photo || signed)

  const ctx=()=>({routeId:route.id,driverId,companyId:route.company_id})

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
      await startRoute(ctx(),operationalDate())
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

  const arrivePickup=async()=>{
    if(!route||busy||!driverId)return
    setBusy(true)
    setMessage('')
    try{
      if(!started) await startRoute(ctx(),operationalDate())
      try{await markArrived(ctx())}catch{}
      await refresh()
      setSheet('pickup')
    }catch(error){
      setMessage(error instanceof Error?error.message:t.drvOpFailed)
    }finally{
      setBusy(false)
    }
  }

  const confirmPickup=async()=>{
    if(!route||busy||!driverId)return
    setBusy(true)
    setMessage('')
    try{
      await completePickupWithEvidence(ctx())
      try{window.sessionStorage.setItem('routehub:last-completed-id',route.id)}catch{}
      setSheet(null)
      await refresh()
    }catch(error){
      setMessage(error instanceof Error?error.message:t.drvOpFailed)
    }finally{
      setBusy(false)
    }
  }

  const completeReturnNow=async()=>{
    if(!route||busy||!driverId)return
    setBusy(true)
    setMessage('')
    try{
      if(!started) await startRoute(ctx(),operationalDate())
      try{await markArrived(ctx())}catch{}
      let location
      try{location=await getCurrentLocation({maximumAge:60_000})}catch{}
      await completeReturn(ctx(),{location})
      try{window.sessionStorage.setItem('routehub:last-completed-id',route.id)}catch{}
      await refresh()
    }catch(error){
      setMessage(error instanceof Error?error.message:t.drvOpFailed)
    }finally{
      setBusy(false)
    }
  }

  const openDelivery=()=>{
    setMessage('')
    setSheet('delivery')
  }

  const sign=(e: React.PointerEvent<HTMLCanvasElement>)=>{
    const c=canvas.current
    if(!c)return
    const box=c.getBoundingClientRect()
    const x=(e.clientX-box.left)*(c.width/box.width)
    const y=(e.clientY-box.top)*(c.height/box.height)
    const g=c.getContext('2d')
    if(!g)return
    if(e.type==='pointerdown'){
      g.beginPath()
      g.moveTo(x,y)
      c.setPointerCapture(e.pointerId)
    }else{
      g.lineTo(x,y)
      g.strokeStyle='#0f1d35'
      g.lineWidth=2
      g.stroke()
      setSigned(true)
    }
  }

  const confirmDelivery=async()=>{
    if(!route||busy||!driverId)return
    const name=recipient.trim()
    if(!name){
      setMessage(t.drvNeedRecipient)
      return
    }
    if(!hasPod){
      setMessage(t.drvNeedPod)
      return
    }
    setBusy(true)
    setMessage('')
    try{
      if(!started) await startRoute(ctx(),operationalDate())
      try{await markArrived(ctx())}catch{}
      if(photo) await uploadStopPhoto(ctx(), photo)
      if(signed && canvas.current) await saveStopSignature(ctx(), canvas.current)
      let location
      try{location=await getCurrentLocation({maximumAge:60_000})}catch{}
      await completeDeliveryWithRecipient(ctx(), name, '', location)
      try{window.sessionStorage.setItem('routehub:last-completed-id',route.id)}catch{}
      setSheet(null)
      setRecipient('')
      setPhoto(null)
      setSigned(false)
      await refresh()
    }catch(error){
      setMessage(error instanceof Error?error.message:t.drvOpFailed)
    }finally{
      setBusy(false)
    }
  }

  const primary=()=>{
    if(!started) return {label:t.drvStartRoute, run:startCurrent}
    if(kind==='pickup') return {label:arrived?t.drvCompletePickup:t.drvArrived, run:arrivePickup}
    if(kind==='return') return {label:t.drvCompleteReturn, run:completeReturnNow}
    return {label:t.drvCompleteDelivery, run:openDelivery}
  }
  const action=primary()

  return <DriverV3Shell active="today" headerStatus={drivingSession?t.drvDayActive:t.drvDayInactive} hideNav={Boolean(sheet)}>
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
              {route.order_number&&<span className={styles.order} style={{fontSize:18,fontWeight:800}}>PO {route.order_number}</span>}
            </div>
            <span className={`${styles.operationIcon} ${styles[kind||'return']}`} aria-hidden="true"><Package/></span>
          </div>
          <div className={styles.divider}/>
          <button type="button" onClick={openMaps} aria-label={t.drvOpenMaps} style={{display:'block',width:'100%',height:160,border:0,padding:0,margin:'0 0 12px',borderRadius:14,overflow:'hidden',background:'#e8eef4'}}>
            <div style={{height:'100%',pointerEvents:'none',visibility:sheet?'hidden':'visible'}}>
            {!sheet&&<LiveRouteMap
              destinationAddress={route.destination_address}
              destinationCoordinate={route.destination_lat!=null&&route.destination_lng!=null?{lat:Number(route.destination_lat),lng:Number(route.destination_lng)}:null}
              driverLocation={liveFix?{lat:liveFix.lat,lng:liveFix.lng}:drivingSession?.last_lat!=null&&drivingSession?.last_lng!=null?{lat:Number(drivingSession.last_lat),lng:Number(drivingSession.last_lng)}:null}
              driverUpdatedAt={liveFix?.at||drivingSession?.last_updated_at||null}
              title={t.drvCurrentStop}
              showHeader={false}
              showLocationUpdated={false}
              interactive={false}
              useDriverAsOrigin
            />}
            </div>
          </button>
          <button className={styles.primary} style={{background:'#16B96B'}} disabled={busy} onClick={()=>void action.run()}>
            <MapPin/>{busy?t.drvBusy:action.label}
          </button>
          <div className={styles.secondaryActions}>
            <button type="button" className={styles.mapAction} onClick={openMaps}><Map/>{t.drvOpenMaps}</button>
            <Link className={styles.issueAction} href="/driver/issue"><TriangleAlert/>{t.drvIssue}</Link>
          </div>
          {message&&!sheet&&<p className={`${styles.feedback}${/could not|failed|pending|error|no se pudo|imposible|add |enter |indica|ajoute/i.test(message)?` ${styles.feedbackError}`:''}`} role="status">{message}</p>}
        </section>
      </>:<section className={styles.stateCard}><Package/><h1>{t.drvNoStops}</h1><p>{t.drvAssignedWork}</p></section>}

      {sheet==='pickup'&&route&&(
        <div style={overlay} onTouchMove={e=>e.preventDefault()}>
          <section className="card" style={dialog} onClick={e=>e.stopPropagation()}>
            <p className="eyebrow">{t.drvPickup}</p>
            <h2 style={{margin:'8px 0 6px',fontSize:26,lineHeight:'30px'}}>{t.drvPickUpPo} {route.order_number||''}</h2>
            <p className="muted" style={{margin:'0 0 18px'}}>{route.destination_name||route.destination_address}</p>
            <button className="primary" disabled={busy} onClick={()=>void confirmPickup()}>{busy?t.drvBusy:t.drvConfirmPickup}</button>
            <button className="secondary" disabled={busy} onClick={()=>setSheet(null)} style={{marginTop:10}}>{t.drvCancel||t.cancel}</button>
          </section>
        </div>
      )}

      {sheet==='delivery'&&route&&(
        <div style={overlay} onTouchMove={e=>e.preventDefault()}>
          <section className="card" style={dialog} onClick={e=>e.stopPropagation()}>
            <p className="eyebrow">{t.drvDelivery}</p>
            <h2 style={{margin:'6px 0 8px'}}>{t.drvCompleteDelivery}</h2>
            {route.order_number&&<p style={{fontSize:22,fontWeight:800,margin:'0 0 12px'}}>PO {route.order_number}</p>}
            <label className="muted" style={{display:'block',marginBottom:8}}>
              {t.drvReceivedBy}
              <input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder={t.drvRecipientName} style={{display:'block',width:'100%',minHeight:48,marginTop:6,border:'1px solid #dde5ee',borderRadius:12,padding:'0 12px',font:'inherit'}}/>
            </label>
            <label className="secondary" style={{display:'block',textAlign:'center',margin:'8px 0'}}>
              {photo?photo.name:t.drvPhoto||'Photo'}
              <input type="file" accept="image/*" capture="environment" hidden onChange={e=>setPhoto(e.target.files?.[0]||null)}/>
            </label>
            <canvas ref={canvas} width={320} height={120} onPointerDown={sign} onPointerMove={e=>e.buttons===1&&sign(e)} style={{width:'100%',height:120,border:'1px dashed #cbd5e1',borderRadius:12,background:'#fff',touchAction:'none'}}/>
            <p className="muted" style={{fontSize:12}}>{t.drvNeedPod}</p>
            {message&&<p className={`${styles.feedback} ${styles.feedbackError}`}>{message}</p>}
            <button className="primary" disabled={busy} onClick={()=>void confirmDelivery()}>{busy?t.drvBusy:t.drvCompleteDelivery}</button>
            <button className="secondary" disabled={busy} onClick={()=>setSheet(null)} style={{marginTop:8}}>{t.drvCancel||t.cancel}</button>
          </section>
        </div>
      )}
    </div>
  </DriverV3Shell>
}

const overlay: React.CSSProperties = {
  position:'fixed',
  inset:0,
  background:'rgba(15,29,53,.58)',
  backdropFilter:'blur(14px)',
  WebkitBackdropFilter:'blur(14px)',
  display:'grid',
  placeItems:'center',
  padding:'20px',
  zIndex:5000,
  touchAction:'none',
  overscrollBehavior:'none',
}
const dialog: React.CSSProperties = {
  width:'min(360px,100%)',
  padding:'22px 20px 18px',
  borderRadius:22,
  boxShadow:'0 18px 40px rgba(15,29,53,.28)',
}

function TodayLoading({label}:{label:string}) {
  return (
    <div className={styles.loading} aria-label={label}>
      <div className={styles.loadingHero}/>
    </div>
  )
}
