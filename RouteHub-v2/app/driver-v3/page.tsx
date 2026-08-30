'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import {Camera, FileText, Map, MapPin, Package, PenLine, TriangleAlert, X} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import DriverV3Shell from '../../components/driver-v3/DriverV3Shell'
import {operationalDate} from '../../lib/driver-queue'
import {completeDeliveryWithRecipient, completePickupWithEvidence, completeReturn, markArrived, saveStopNote, saveStopSignature, startRoute, uploadStopPhoto} from '../../lib/driver-v3/actions'
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
  const [issueOpen,setIssueOpen]=useState(false)
  const [issueNote,setIssueNote]=useState('')
  const [podPanel,setPodPanel]=useState<null | 'photo' | 'signature' | 'notes' | 'issue'>(null)
  const [askName,setAskName]=useState(false)
  const nameRef=useRef<HTMLInputElement>(null)
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

  const arrivePickup=()=>{
    if(!route||!driverId)return
    setMessage('')
    setSheet('pickup')
    void (async()=>{
      try{
        if(!started) await startRoute(ctx(),operationalDate())
        try{await markArrived(ctx())}catch{}
      }catch(error){
        setMessage(error instanceof Error?error.message:t.drvOpFailed)
      }
    })()
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
      setAskName(true)
      setPodPanel(null)
      setMessage(t.drvNeedRecipient)
      setTimeout(()=>nameRef.current?.focus(),50)
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
      setAskName(false)
      await refresh()
    }catch(error){
      setMessage(error instanceof Error?error.message:t.drvOpFailed)
    }finally{
      setBusy(false)
    }
  }


  const savePickupNote=async()=>{
    if(!route||busy||!driverId)return
    const note=issueNote.trim()
    if(!note){
      setMessage(t.drvNeedNote)
      return
    }
    setBusy(true)
    try{
      await saveStopNote(ctx(), note)
      setIssueOpen(false)
      setMessage(t.drvNoteSaved)
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
              {kind!=='return'&&route.order_number&&<span className={styles.order} style={{fontSize:18,fontWeight:800}}>PO {route.order_number}</span>}
            </div>
            <span className={`${styles.operationIcon} ${styles[kind||'return']}`} aria-hidden="true"><Package/></span>
          </div>
          <div className={styles.divider}/>
          <button type="button" onClick={openMaps} aria-label={t.drvOpenMaps} style={{display:'block',width:'100%',height:160,border:0,padding:0,margin:'0 0 12px',borderRadius:14,overflow:'hidden',background:'#e8eef4'}}>
            <div style={{height:'100%',pointerEvents:'none',visibility:sheet?'hidden':'visible'}}>
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
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <p className="eyebrow" style={{margin:0}}>{t.drvPickup}</p>
              <button type="button" aria-label={t.drvCancel||t.cancel} onClick={()=>{setSheet(null);setIssueOpen(false)}} style={{width:32,height:32,border:0,borderRadius:16,background:'#e8eef4',color:'#0f1d35',display:'grid',placeItems:'center',padding:0}}>
                <X size={16}/>
              </button>
            </div>
            <h2 style={{margin:'0 0 4px',fontSize:22,lineHeight:'26px'}}>{route.destination_name||route.destination_address}</h2>
            {route.destination_address&&<p className="muted" style={{margin:'0 0 8px',fontSize:14}}>{route.destination_address}</p>}
            <p className="muted" style={{margin:'0 0 12px',fontSize:13,lineHeight:'18px'}}>{t.drvPickupHelp}</p>
            {route.order_number?(
            <div style={{margin:'0 0 16px',padding:'12px 14px',borderRadius:14,background:'#fff',border:'1px solid #e5eaf0'}}>
              <p style={{margin:0,fontSize:11,fontWeight:800,letterSpacing:'.14em',color:'#667280'}}>PO</p>
              <p style={{margin:'4px 0 0',fontSize:28,lineHeight:'32px',fontWeight:800,letterSpacing:'-0.03em'}}>{route.order_number}</p>
            </div>
            ):null}
            {issueOpen?(
              <>
                <textarea value={issueNote} onChange={e=>setIssueNote(e.target.value)} placeholder={t.drvOptionalNote} rows={3} style={{width:'100%',border:'1px solid #dde5ee',borderRadius:12,padding:10,font:'inherit',marginBottom:10}}/>
                <button className="secondary" disabled={busy} onClick={()=>void savePickupNote()}>{busy?t.drvBusy:t.drvSubmitIssue}</button>
              </>
            ):null}
            {message&&<p className={styles.feedback} style={{marginTop:8}}>{message}</p>}
            <button className="primary" disabled={busy} onClick={()=>void confirmPickup()} style={{background:'#16B96B',width:'100%'}}>{busy?t.drvBusy:t.drvConfirmPickup}</button>
            <button type="button" disabled={busy} onClick={()=>setIssueOpen(true)} style={{display:'block',width:'100%',marginTop:12,border:0,background:'transparent',color:'#E11D48',font:'inherit',fontSize:13,fontWeight:700}}>{t.drvReportProblem}</button>
          </section>
        </div>
      )}

      {sheet==='delivery'&&route&&(
        <div style={overlay} onTouchMove={e=>e.preventDefault()}>
          <section className="card" style={dialog} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <p className="eyebrow" style={{margin:0}}>{t.drvDelivery}</p>
              <button type="button" aria-label={t.drvCancel||t.cancel} onClick={()=>{setSheet(null);setPodPanel(null)}} style={{width:32,height:32,border:0,borderRadius:16,background:'#e8eef4',color:'#0f1d35',display:'grid',placeItems:'center',padding:0}}>
                <X size={16}/>
              </button>
            </div>
            <h2 style={{margin:'0 0 4px',fontSize:22,lineHeight:'26px'}}>{route.destination_name||t.drvCompleteDelivery}</h2>
            {route.destination_address&&<p className="muted" style={{margin:'0 0 8px',fontSize:14}}>{route.destination_address}</p>}
            <p className="muted" style={{margin:'0 0 12px',fontSize:13,lineHeight:'18px'}}>{t.drvDeliveryHelp}</p>
            {route.order_number?(
            <div style={{margin:'0 0 12px',padding:'12px 14px',borderRadius:14,background:'#fff',border:'1px solid #e5eaf0'}}>
              <p style={{margin:0,fontSize:11,fontWeight:800,letterSpacing:'.14em',color:'#667280'}}>PO</p>
              <p style={{margin:'4px 0 0',fontSize:28,lineHeight:'32px',fontWeight:800}}>{route.order_number}</p>
            </div>
            ):null}
            <label className="muted" style={{display:'block',marginBottom:12,padding:askName?'12px':'0',borderRadius:14,background:askName?'#fff7ed':'transparent',border:askName?'1px solid #fdba74':'0'}}>
              {t.drvReceivedBy}
              <input ref={nameRef} value={recipient} onChange={e=>{setRecipient(e.target.value);if(e.target.value.trim())setAskName(false)}} placeholder={t.drvRecipientName} style={{display:'block',width:'100%',minHeight:48,marginTop:6,border:'1px solid #dde5ee',borderRadius:12,padding:'0 12px',font:'inherit',boxSizing:'border-box',background:'#fff'}}/>
            </label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
              <button type="button" className="secondary" onClick={()=>setPodPanel('photo')} style={{...tileBtn,color:photo?'#16B96B':undefined}}>
                <Camera size={20}/>{t.drvPhoto||'Foto'}
              </button>
              <button type="button" className="secondary" onClick={()=>setPodPanel('signature')} style={{...tileBtn,color:signed?'#16B96B':undefined}}>
                <PenLine size={20}/>{t.drvSignature||'Firma'}
              </button>
              <button type="button" className="secondary" onClick={()=>setPodPanel('notes')} style={tileBtn}>
                <FileText size={20}/>{t.drvNotes||'Notas'}
              </button>
              <button type="button" className="secondary" onClick={()=>setPodPanel('issue')} style={{...tileBtn,color:'#EF5350',borderColor:'#f5c2c0'}}>
                <TriangleAlert size={20}/>{t.drvIssue}
              </button>
            </div>
            {podPanel==='photo'&&(
              <label className="secondary" style={{display:'block',textAlign:'center',marginBottom:10}}>
                {photo?photo.name:t.drvTakePhoto||t.drvPhoto}
                <input type="file" accept="image/*" capture="environment" hidden onChange={e=>setPhoto(e.target.files?.[0]||null)}/>
              </label>
            )}
            {podPanel==='signature'&&(
              <canvas ref={canvas} width={320} height={120} onPointerDown={sign} onPointerMove={e=>e.buttons===1&&sign(e)} style={{width:'100%',height:120,border:'1px dashed #cbd5e1',borderRadius:12,background:'#fff',touchAction:'none',marginBottom:10}}/>
            )}
            {(podPanel==='notes'||podPanel==='issue')&&(
              <textarea value={issueNote} onChange={e=>setIssueNote(e.target.value)} placeholder={t.drvOptionalNote} rows={3} style={{width:'100%',border:'1px solid #dde5ee',borderRadius:12,padding:10,font:'inherit',marginBottom:10,boxSizing:'border-box'}}/>
            )}
            {message&&<p className={`${styles.feedback} ${styles.feedbackError}`}>{message}</p>}
            <button className="primary" disabled={busy} onClick={()=>void confirmDelivery()} style={{background:'#16B96B',width:'100%'}}>{busy?t.drvBusy:t.drvCompleteDelivery}</button>
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
  position:'relative',
  width:'min(340px,calc(100% - 32px))',
  padding:'18px 16px 16px',
  borderRadius:20,
  background:'#f7f9fc',
  border:'1px solid #e5eaf0',
  boxShadow:'0 16px 36px rgba(15,29,53,.22)',
}

const tileBtn: React.CSSProperties = {
  minHeight:72,display:'grid',placeItems:'center',gap:4,padding:8,fontSize:12,lineHeight:'14px',textAlign:'center',whiteSpace:'normal'
}

function TodayLoading({label}:{label:string}) {
  return (
    <div className={styles.loading} aria-label={label}>
      <div className={styles.loadingHero}/>
    </div>
  )
}
