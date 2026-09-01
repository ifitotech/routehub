'use client'

import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import dynamic from 'next/dynamic'
import {Camera, ChevronRight, Map, MapPin, Package, PenLine, Phone, TriangleAlert, X} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import DriverV3Shell from '../../components/driver-v3/DriverV3Shell'
import {operationalDate} from '../../lib/driver-queue'
import {completeDelivery, completeDeliveryWithRecipient, completePickupWithEvidence, completeReturn, markArrived, reportIssue, saveStopNote, saveStopSignature, startRoute, uploadStopPhoto} from '../../lib/driver-v3/actions'
import {startTemporaryRouteSession} from '../../lib/driving-session'
import {useDriverData} from '../../lib/driver-v3/use-driver-data'
import {openNavigation} from '../../lib/maps/external-navigation'
import {getCurrentLocation} from '../../lib/location'
import {updateDrivingLocation} from '../../lib/driving-session'
import {driverOperationPhase} from '../../lib/driver/driver-state'
import {useLocale} from '../../lib/use-preferences'
import {routeNumber} from '../../lib/route-number'
import styles from './today.module.css'

const OpenStreetRoutePreview = dynamic(() => import('../../components/openstreet-route-preview'), {ssr: false})

export default function DriverV3Page() {
  const router=useRouter()
  const searchParams=useSearchParams()
  const {t}=useLocale()
  const {loading,error,snapshot,driverId,companyId,branchId,refresh,drivingSession,liveFix}=useDriverData()
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [sheet,setSheet]=useState<null | 'pickup' | 'delivery' | 'return' | 'info'>(null)
  const [recipient,setRecipient]=useState('')
  const [photo,setPhoto]=useState<File | null>(null)
  const [signed,setSigned]=useState(false)
  const [issueOpen,setIssueOpen]=useState(false)
  const [issueNote,setIssueNote]=useState('')
  const [podPanel,setPodPanel]=useState<null | 'photo' | 'signature' | 'notes' | 'issue'>(null)
  const [askName,setAskName]=useState(false)
  const nameRef=useRef<HTMLInputElement>(null)
  const photoRef=useRef<HTMLInputElement>(null)
  const [nameFocus,setNameFocus]=useState(false)
  const canvas=useRef<HTMLCanvasElement>(null)
  const openedCompletionRef=useRef('')
  const operation=snapshot?.currentOperation
  const route=operation?.route as any
  const kind=operation?.kind==='branch'?'return':operation?.kind
  const nextRoute=snapshot?.queue.upcoming?.[0] as any
  const nextKind=nextRoute?.mission_type==='branch'?'return':nextRoute?.mission_type
  const nextLabel=nextKind==='pickup'?t.drvPickup:nextKind==='delivery'?t.drvDelivery:t.drvReturn
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
  const phase=route?driverOperationPhase(route):'pending'
  const started=phase==='started'||phase==='arrived'
  const arrived=phase==='arrived'
  const hasPod=Boolean(route?.completion_photo_path || route?.customer_signature_path || photo || signed)
  const ctx=()=>({routeId:route.id,driverId,companyId:route.company_id})

  // The full-screen navigator confirms arrival first, then comes back here
  // with the authoritative route id so the Driver immediately sees the right
  // completion menu instead of having to find the action again.
  useEffect(()=>{
    const requested=searchParams.get('complete')
    const requestedRoute=searchParams.get('route')
    const currentKind=kind==='pickup'||kind==='delivery'||kind==='return'?kind:null
    const key=`${requested || ''}:${requestedRoute || ''}`
    if(!requested||!route?.id||!arrived||requestedRoute!==String(route.id)||requested!==currentKind||openedCompletionRef.current===key)return
    openedCompletionRef.current=key
    setSheet(currentKind)
    window.history.replaceState(null,'','/driver')
  },[arrived,kind,route?.id,searchParams])

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
      // Driver V3 can receive the company id from the route snapshot before
      // the membership bootstrap finishes; use the authoritative route value
      // so Start Delivery is not silently rejected during that short window.
      await startRoute({...ctx(),companyId:companyId||String(route.company_id||'')},operationalDate())
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
      // Keep RouteHub Navigation ready for an intentional beta test after the
      // driver returns, while Apple/Google Maps remains the primary navigator.
      void router.prefetch('/driver/map')
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
      // A recovered stop may already be arrived or marked issue. Do not try
      // to restart it; go straight to the guarded completion mutation.
      if(!started && !route.arrived_at && !['issue','completed'].includes(String(route.status || ''))) await startRoute(ctx(),operationalDate())
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

  const openReturn=()=>{
    setMessage('')
    setSheet('return')
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
    const withIssue=podPanel==='issue'||Boolean(issueNote.trim())
    if(!withIssue && !name){
      setAskName(true)
      setNameFocus(true)
      setPodPanel(null)
      setMessage(t.drvNeedRecipient)
      return
    }
    setBusy(true)
    setMessage('')
    try{
      if(!started) await startRoute(ctx(),operationalDate())
      try{await markArrived(ctx())}catch{}
      if(photo) await uploadStopPhoto(ctx(), photo)
      if(signed && canvas.current) await saveStopSignature(ctx(), canvas.current)
      if(issueNote.trim()){
        try{await saveStopNote(ctx(), issueNote.trim())}catch{}
      }
      let location
      try{location=await getCurrentLocation({maximumAge:60_000})}catch{}
      if(withIssue){
        await reportIssue(ctx(), issueNote.trim()||'Issue reported on delivery')
      }else if(name){
        await completeDeliveryWithRecipient(ctx(), name, issueNote, location)
      }else{
        await completeDelivery(ctx())
      }
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
    if(!started) {
      const startLabel=kind==='pickup'?(t.drvStartPickup||t.drvStartRoute):kind==='delivery'?(t.drvStartDelivery||t.drvStartRoute):kind==='return'?(t.drvStartReturn||t.drvStartRoute):t.drvStartRoute
      return {label:startLabel, run:startCurrent}
    }
    if(kind==='pickup') return {label:t.drvCompletePickup, run:arrivePickup}
    if(kind==='return') return {label:t.drvCompleteReturn, run:openReturn}
    return {label:t.drvCompleteDelivery, run:openDelivery}
  }
  const action=primary()

  return <DriverV3Shell active="today" headerStatus={drivingSession?t.drvDayActive:t.drvDayInactive} hideNav={Boolean(sheet)}>
    <div className={styles.page}>
            {loading?<TodayLoading label={t.drvLoadingRoute}/>:error?<section className={styles.stateCard}>
        <h1>{t.drvCouldntLoad}</h1><p>{t.drvConnRetry}</p>
        <button type="button" onClick={()=>void refresh()}>{t.drvTryAgain}</button>
      </section>:operation&&route?<>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <span className={`${styles.typeBadge} ${styles[kind||'return']}`}><Package/>{kind==='pickup'?t.drvPickup||'PICKUP':kind==='delivery'?t.drvDelivery||'DELIVERY':t.drvReturn||'RETURN'}</span>
            <span className="muted" style={{fontSize:12,fontWeight:700}}>ROUTE {routeNumber(route)}</span>
          </div>
          <div className={styles.destination} onClick={()=>setSheet('info')} role="button">
            <div>
              <h1>{route.destination_name||route.destination_address||t.drvCurrentStopName}</h1>
              {route.destination_address&&<p>{route.destination_address}</p>}
              {kind!=='return'&&route.order_number&&<span className={styles.order} style={{fontSize:18,fontWeight:800}}>PO {route.order_number}</span>}
            </div>
            {route.destination_phone?(
              <a href={`tel:${String(route.destination_phone).replace(/[^\d+]/g,'')}`} className={styles.operationIcon} style={{background:'#EAF2FF',color:'#1667F2',textDecoration:'none'}} aria-label={t.drvCall||'Call'}>
                <Phone/>
              </a>
            ):(
              <span className={`${styles.operationIcon} ${styles[kind||'return']}`} aria-hidden="true"><Package/></span>
            )}
          </div>
          <button type="button" onClick={()=>setSheet('info')} style={{display:'flex',alignItems:'center',gap:10,width:'100%',border:0,background:'#F4F7FB',borderRadius:14,padding:'12px 12px',margin:'8px 0 0',textAlign:'left'}}>
            <span style={{width:28,height:28,borderRadius:14,background:kind==='delivery'?'#7C5CFF':kind==='pickup'?'#1667F2':'#0F1D35',color:'#fff',display:'grid',placeItems:'center',fontSize:13,fontWeight:800,flexShrink:0}}>1</span>
            <span style={{flex:1,minWidth:0}}>
              <strong style={{display:'block',fontSize:15}}>
                {route.destination_contact_name||route.destination_name||t.drvCurrentStopName}
                {route.destination_phone?` · ${route.destination_phone}`:''}
              </strong>
              <span className="muted" style={{fontSize:12,display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {route.notes||route.driver_note||(kind==='delivery'?t.drvDeliveryHelp:kind==='pickup'?t.drvPickupHelp:t.drvReturnHelp)}
              </span>
            </span>
            <ChevronRight size={18} color="#94A3B8"/>
          </button>
          <div className={styles.divider}/>
          <div className={styles.mapPreview} role="button" tabIndex={0} aria-label={t.drvOpenInternalMap} onClick={()=>router.push('/driver/map')} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();router.push('/driver/map')}}}>
            <div style={{height:'100%',pointerEvents:'none',visibility:sheet?'hidden':'visible'}}>
            <OpenStreetRoutePreview
              destination={route.destination_lat!=null&&route.destination_lng!=null?{lat:Number(route.destination_lat),lng:Number(route.destination_lng)}:null}
              driverLocation={liveFix?{lat:liveFix.lat,lng:liveFix.lng}:drivingSession?.last_lat!=null&&drivingSession?.last_lng!=null?{lat:Number(drivingSession.last_lat),lng:Number(drivingSession.last_lng)}:null}
              label={route.destination_name||route.destination_address||t.drvCurrentStopName}
            />
            </div>
          </div>
          <button className={styles.primary} style={{background:'#16B96B'}} disabled={busy} onClick={()=>void action.run()}>
            <MapPin/>{busy?t.drvBusy:action.label}
          </button>
          <div className={styles.secondaryActions}>
            <button type="button" className={styles.mapAction} onClick={openMaps}><Map/>{t.drvOpenMaps}</button>
            <button type="button" className={styles.issueAction} onClick={()=>{
              if(kind==='delivery'){setSheet('delivery');setPodPanel('issue')}
              else {setSheet('pickup');setIssueOpen(true)}
            }}><TriangleAlert/>{t.drvIssue}</button>
          </div>
          {message&&!sheet&&<p className={`${styles.feedback}${/could not|failed|pending|error|no se pudo|imposible|add |enter |indica|ajoute/i.test(message)?` ${styles.feedbackError}`:''}`} role="status">{message}</p>}
        </section>
        <section className={`${styles.summary} ${styles.nextStopSummary}`} aria-label={t.drvNextStop}>
          <p className="eyebrow">{t.drvNextStop}</p>
          {nextRoute?(
            <div className={styles.nextStopContent}>
              <div>
                <span className={`${styles.typeBadge} ${styles[nextKind||'return']}`}><Package/>{nextLabel}</span>
                <strong>{nextRoute.destination_name||nextRoute.destination_address||t.drvCurrentStopName}</strong>
                {nextRoute.destination_address&&<p>{nextRoute.destination_address}</p>}
              </div>
              <ChevronRight aria-hidden="true"/>
            </div>
          ):<div className={styles.nextStopEmpty}>{t.drvNoMoreStops}</div>}
        </section>
      </>:<section className={styles.stateCard}><Package/><h1>{t.drvNoStops}</h1><p>{t.drvAssignedWork}</p></section>}

      {sheet==='info'&&route&&(
        <div style={overlay} onTouchMove={e=>e.preventDefault()}>
          <section className="card" style={dialog} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <p className="eyebrow" style={{margin:0}}>{kind==='pickup'?t.drvPickup:kind==='delivery'?t.drvDelivery:t.drvReturn}</p>
              <button type="button" aria-label={t.drvCancel||t.cancel} onClick={()=>setSheet(null)} style={{width:32,height:32,border:0,borderRadius:16,background:'#e8eef4',color:'#0f1d35',display:'grid',placeItems:'center',padding:0}}>
                <X size={16}/>
              </button>
            </div>
            <h2 style={{margin:'0 0 4px',fontSize:22}}>{route.destination_name||t.drvCurrentStopName}</h2>
            {route.destination_address&&<p className="muted" style={{margin:'0 0 10px'}}>{route.destination_address}</p>}
            {kind!=='return'&&route.order_number?<p style={{margin:'0 0 12px',fontSize:22,fontWeight:800}}>PO {route.order_number}</p>:null}
            <p style={{margin:'0 0 14px',fontSize:14,lineHeight:1.45,color:'#334155'}}>
              {kind==='pickup'?t.drvPickupHelp:kind==='delivery'?t.drvDeliveryHelp:(t.drvReturnHelp||t.drvReturn)}
            </p>
            {route.notes?<p className="muted" style={{margin:'0 0 14px'}}>{route.notes}</p>:null}
            {route.destination_phone?(
              <a href={`tel:${String(route.destination_phone).replace(/[^\d+]/g,'')}`} className="primary" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,textDecoration:'none',marginBottom:10}}>
                <Phone size={18}/>{t.drvCall||'Call'} {route.destination_phone}
              </a>
            ):null}
            <button className="secondary" type="button" onClick={()=>{setSheet(null);openMaps()}}>{t.drvOpenMaps}</button>
          </section>
        </div>
      )}

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

      {sheet==='return'&&route&&(
        <div style={overlay} onTouchMove={e=>e.preventDefault()}>
          <section className="card" style={dialog} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <p className="eyebrow" style={{margin:0}}>{t.drvReturn}</p>
              <button type="button" aria-label={t.drvCancel||t.cancel} onClick={()=>setSheet(null)} style={{width:32,height:32,border:0,borderRadius:16,background:'#e8eef4',color:'#0f1d35',display:'grid',placeItems:'center',padding:0}}>
                <X size={16}/>
              </button>
            </div>
            <h2 style={{margin:'0 0 5px',fontSize:22,lineHeight:'26px'}}>{route.destination_name||route.destination_address||t.drvReturn}</h2>
            {route.destination_address&&<p className="muted" style={{margin:'0 0 12px',fontSize:14}}>{route.destination_address}</p>}
            <p className="muted" style={{margin:'0 0 16px',fontSize:14,lineHeight:'20px'}}>{t.drvReturnHelp||t.drvReturn}</p>
            {message&&<p className={`${styles.feedback} ${styles.feedbackError}`}>{message}</p>}
            <button className="primary" disabled={busy} onClick={()=>void completeReturnNow()} style={{background:'#16B96B',width:'100%'}}>{busy?t.drvBusy:t.drvCompleteReturn}</button>
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
              <input ref={nameRef} value={recipient} onFocus={()=>{setNameFocus(true);setPodPanel(null)}} onBlur={()=>setNameFocus(false)} onChange={e=>{setRecipient(e.target.value);if(e.target.value.trim())setAskName(false)}} placeholder={t.drvRecipientName} style={{display:'block',width:'100%',minHeight:48,marginTop:6,border:'1px solid #dde5ee',borderRadius:12,padding:'0 12px',font:'inherit',boxSizing:'border-box',background:'#fff'}}/>
            </label>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={e=>setPhoto(e.target.files?.[0]||null)}/>
            {!nameFocus&&(
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
              <button type="button" className="secondary" onClick={()=>{if(!recipient.trim()){setAskName(true);setNameFocus(true);setMessage(t.drvNeedRecipient);return}photoRef.current?.click()}} style={{...tileBtn,color:photo?'#16B96B':undefined}}>
                <Camera size={20}/>{t.drvPhoto||'Foto'}
              </button>
              <button type="button" className="secondary" onClick={()=>setPodPanel(podPanel==='signature'?null:'signature')} style={{...tileBtn,color:signed?'#16B96B':undefined}}>
                <PenLine size={20}/>{t.drvSignature||'Firma'}
              </button>
              <button type="button" className="secondary" onClick={()=>setPodPanel(podPanel==='issue'?null:'issue')} style={{...tileBtn,color:'#EF5350',borderColor:'#f5c2c0'}}>
                <TriangleAlert size={20}/>{t.drvIssue}
              </button>
            </div>
            )}
            {!nameFocus&&podPanel==='signature'&&(
              <div style={{marginBottom:10}}>
                <canvas ref={canvas} width={340} height={180} onPointerDown={sign} onPointerMove={e=>e.buttons===1&&sign(e)} style={{width:'100%',height:180,border:'1px dashed #cbd5e1',borderRadius:12,background:'#fff',touchAction:'none'}}/>
                <button type="button" className="secondary" onClick={()=>{const c=canvas.current;if(!c)return;c.getContext('2d')?.clearRect(0,0,c.width,c.height);setSigned(false)}} style={{marginTop:8,width:'100%'}}>{t.drvClear}</button>
              </div>
            )}
            {!nameFocus&&podPanel==='issue'&&(
              <textarea value={issueNote} onChange={e=>setIssueNote(e.target.value)} placeholder={t.drvOptionalNote} rows={3} style={{width:'100%',border:'1px solid #dde5ee',borderRadius:12,padding:10,font:'inherit',marginBottom:10,boxSizing:'border-box'}}/>
            )}
            {message&&<p className={`${styles.feedback} ${styles.feedbackError}`}>{message}</p>}
            <button className="primary" disabled={busy} onClick={()=>void confirmDelivery()} style={{background:podPanel==='issue'?'#E11D48':'#16B96B',width:'100%'}}>{busy?t.drvBusy:(podPanel==='issue'?(t.drvCompleteWithIssue||'COMPLETE WITH ISSUE'):t.drvCompleteDelivery)}</button>
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
