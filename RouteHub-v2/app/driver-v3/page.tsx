'use client'

import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {ChevronRight, Map, MapPin, Package, PackageCheck, PackagePlus, Phone, TriangleAlert, Truck, Warehouse} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import DriverV3Shell from '../../components/driver-v3/DriverV3Shell'
import {operationalDate} from '../../lib/driver-queue'
import {completeDelivery, completeDeliveryWithRecipient, completePickupWithEvidence, completeReturn, markArrived, reportIssue, saveStopNote, saveStopSignature, startRoute, uploadStopPhoto} from '../../lib/driver-v3/actions'
import {startTemporaryRouteSession} from '../../lib/driving-session'
import {useDriverData} from '../../lib/driver-v3/use-driver-data'
import {openNavigationWithFallback} from '../../lib/maps/external-navigation'
import {getCurrentLocation} from '../../lib/location'
import {updateDrivingLocation} from '../../lib/driving-session'
import {driverOperationPhase} from '../../lib/driver/driver-state'
import {useLocale} from '../../lib/use-preferences'
import {routeNumber} from '../../lib/route-number'
import styles from './today.module.css'
import confirmStyles from '../../components/driver-v3/driver-v3.module.css'
import DriverRouteEstimate from '../../components/driver-v3/DriverRouteEstimate'
import {InfoSheet, PickupSheet, ReturnSheet, NextStopSheet, DeliverySheet} from './today-sheets'

export default function DriverV3Page() {
  const router=useRouter()
  const searchParams=useSearchParams()
  const {t,locale}=useLocale()
  const {loading,error,snapshot,driverId,companyId,branchId,refresh,drivingSession}=useDriverData()
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [sheet,setSheet]=useState<null | 'pickup' | 'delivery' | 'return' | 'info' | 'next'>(null)
  const [recipient,setRecipient]=useState('')
  const [photo,setPhoto]=useState<File | null>(null)
  const [signed,setSigned]=useState(false)
  const [issueOpen,setIssueOpen]=useState(false)
  const [issueNote,setIssueNote]=useState('')
  const [podPanel,setPodPanel]=useState<null | 'photo' | 'signature' | 'notes' | 'issue'>(null)
  const [confirmPickupOpen,setConfirmPickupOpen]=useState(false)
  const [askName,setAskName]=useState(false)
  const nameRef=useRef<HTMLInputElement>(null)
  const photoRef=useRef<HTMLInputElement>(null)
  const [nameFocus,setNameFocus]=useState(false)
  const canvas=useRef<HTMLCanvasElement>(null)
  const openedCompletionRef=useRef('')
  const swipeStartY=useRef<number|null>(null)
  const refreshStartY=useRef<number|null>(null)
  const refreshDistance=useRef(0)
  const [refreshing,setRefreshing]=useState(false)
  const [pullDistance,setPullDistance]=useState(0)
  const operation=snapshot?.currentOperation
  const route=operation?.route as any
  const kind=operation?.kind==='branch'?'return':operation?.kind
  // A shared Package icon for every stop type made the badge/avatar read the
  // same at a glance regardless of what the driver actually has to do next.
  const StopIcon=kind==='pickup'?PackagePlus:kind==='delivery'?PackageCheck:Warehouse
  const serviceContext=kind==='pickup'
    ? (route?.order_number ? `PO ${route.order_number}` : (locale==='es'?'Parada de recogida':'Pickup stop'))
    : kind==='delivery'
      ? (locale==='es'?'Parada de entrega':'Delivery stop')
      : (locale==='es'?'Regreso a sucursal':'Return to branch')
  const nextRoute=snapshot?.queue.upcoming?.[0] as any
  const nextKind=nextRoute?.mission_type==='branch'?'return':nextRoute?.mission_type
  const nextLabel=nextKind==='pickup'?t.drvPickup:nextKind==='delivery'?t.drvDelivery:t.drvReturn
  const NextStopIcon=nextKind==='pickup'?PackagePlus:nextKind==='delivery'?PackageCheck:Warehouse
  const currentStopPosition=Math.max(1,Number(route?.position)||1)
  const visibleStopCount=currentStopPosition+(snapshot?.queue.upcoming?.length||0)
  const stopSummary=locale==='es'
    ? `PARADA ACTUAL · ${currentStopPosition} DE ${visibleStopCount}`
    : `CURRENT STOP · ${currentStopPosition} OF ${visibleStopCount}`
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

  const openMapsForRoute=(target:any)=>{
    if(!target)return
    openNavigationWithFallback({
      address:target.destination_address,
      coordinate:target.destination_lat!=null&&target.destination_lng!=null?{lat:Number(target.destination_lat),lng:Number(target.destination_lng)}:null,
      label:target.destination_name,
    })
  }

  const openMaps=()=>openMapsForRoute(route)

  const startCurrent=async()=>{
    if(!route||busy)return
    setBusy(true)
    setMessage('')
    try{
      // Driver V3 can receive the company id from the route snapshot before
      // the membership bootstrap finishes; use the authoritative route value
      // so Start Delivery is not silently rejected during that short window.
      await startRoute({...ctx(),companyId:String(route.company_id||companyId||'')},operationalDate())
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
      // Navigation stays in the driver's installed map app. RouteHub records
      // the start first, then hands off the same authoritative destination.
      openMapsForRoute(route)
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

  const requestPhoto=()=>{
    if(!recipient.trim()){setAskName(true);setNameFocus(true);setMessage(t.drvNeedRecipient);return}
    photoRef.current?.click()
  }

  const primary=()=>{
    if(!started) {
      const startLabel=kind==='pickup'?(t.drvStartPickup||t.drvStartRoute):kind==='delivery'?(t.drvStartDelivery||t.drvStartRoute):kind==='return'?(t.drvStartReturn||t.drvStartRoute):t.drvStartRoute
      return {label:startLabel, run:startCurrent}
    }
    // Pickup completion records arrival and completion together in one
    // irreversible call - unlike Delivery/Return it has no evidence sheet in
    // between, so a mis-tap on the hero button would close the whole stop
    // with nothing to undo. A confirm step (same pattern as ending Driving
    // Day) covers that without adding a full second screen.
    if(kind==='pickup') return {label:t.drvCompletePickup, run:async()=>setConfirmPickupOpen(true)}
    if(kind==='return') return {label:t.drvCompleteReturn, run:openReturn}
    return {label:t.drvCompleteDelivery, run:openDelivery}
  }
  const action=primary()
  const routeSwipeAction=()=>nextRoute?setSheet('next'):router.push('/driver/history')
  const routeSwipeStart=(event:React.TouchEvent<HTMLButtonElement>)=>{swipeStartY.current=event.touches[0]?.clientY??null}
  const routeSwipeEnd=(event:React.TouchEvent<HTMLButtonElement>)=>{
    if(swipeStartY.current==null)return
    const delta=swipeStartY.current-(event.changedTouches[0]?.clientY??swipeStartY.current)
    swipeStartY.current=null
    if(delta>28)routeSwipeAction()
  }
  const refreshToday=async()=>{
    if(refreshing||sheet)return
    setRefreshing(true)
    try{await refresh()}finally{setRefreshing(false);setPullDistance(0)}
  }
  const pullStart=(event:React.TouchEvent<HTMLDivElement>)=>{
    if(sheet||refreshing)return
    refreshStartY.current=event.touches[0]?.clientY??null
  }
  const pullMove=(event:React.TouchEvent<HTMLDivElement>)=>{
    if(refreshStartY.current==null)return
    const distance=Math.max(0,(event.touches[0]?.clientY??refreshStartY.current)-refreshStartY.current)
    refreshDistance.current=Math.min(distance,88)
    setPullDistance(refreshDistance.current)
  }
  const pullEnd=(event:React.TouchEvent<HTMLDivElement>)=>{
    const distance=refreshDistance.current
    refreshStartY.current=null
    refreshDistance.current=0
    if(distance>=64)void refreshToday()
    else setPullDistance(0)
  }
  // Keep the primary navigation available on the empty Today state. A stale
  // completion sheet must not hide the nav after the last route is completed.
  return <DriverV3Shell active="today" headerStatus={drivingSession?t.drvDayActive:t.drvDayInactive} hideNav={Boolean((sheet&&operation)||confirmPickupOpen)}>
    <div className={styles.page} onTouchStart={pullStart} onTouchMove={pullMove} onTouchEnd={pullEnd}>
      {pullDistance > 0 && <div className={`${styles.pullScene} ${pullDistance >= 24 ? styles.pullReady : ''}`} style={{opacity: Math.max(pullDistance / 24, 0.4)}}>
        <div className={styles.pullRoad}>
          <span className={styles.pullRoadLine}/>
        </div>
        <div className={`${styles.pullTruck} ${refreshing ? styles.pullTruckDriving : ''}`} style={!refreshing ? {left: `${8 + (pullDistance / 88) * 74}%`, transform: `translate(-50%, -50%) ${pullDistance >= 24 ? 'scale(1.12)' : 'scale(1)'}`} : undefined}>
          <Truck size={16} strokeWidth={2.3}/>
        </div>
      </div>}
            {loading?<TodayLoading label={t.drvLoadingRoute}/>:error?<section className={styles.stateCard}>
        <h1>{t.drvCouldntLoad}</h1><p>{t.drvConnRetry}</p>
        <button type="button" onClick={()=>void refresh()}>{t.drvTryAgain}</button>
      </section>:operation&&route?<>
        <section className={`${styles.hero} ${kind==='pickup'?styles.servicePickup:kind==='delivery'?styles.serviceDelivery:styles.serviceReturn}`}>
          <div className={styles.heroTop}>
            <span className={`${styles.typeBadge} ${styles[kind||'return']}`}><StopIcon/>{kind==='pickup'?t.drvPickup||'PICKUP':kind==='delivery'?t.drvDelivery||'DELIVERY':t.drvReturn||'RETURN'}</span>
            <span className="muted" style={{fontSize:12,fontWeight:700}}>ROUTE {routeNumber(route)}</span>
          </div>
          <p className={styles.stopSummary}>{stopSummary}</p>
          <div className={styles.destination} onClick={()=>setSheet('info')} role="button">
            <div>
              <h1>{route.destination_name||route.destination_address||t.drvCurrentStopName}</h1>
              {route.destination_address&&<p>{route.destination_address}</p>}
              <div className={styles.orderSlot}>
                <span className={styles.order}>{serviceContext}</span>
              </div>
            </div>
            {route.destination_phone?(
              <a href={`tel:${String(route.destination_phone).replace(/[^\d+]/g,'')}`} className={styles.operationIcon} style={{background:'#EAF2FF',color:'#1667F2',textDecoration:'none'}} aria-label={t.drvCall||'Call'}>
                <Phone/>
              </a>
            ):(
              <span className={`${styles.operationIcon} ${styles[kind||'return']}`} aria-hidden="true"><StopIcon/></span>
            )}
          </div>
          <button type="button" onClick={()=>setSheet('info')} className={styles.stopDetails}>
            <span className={`${styles.stopNumber} ${styles[kind||'return']}`}>1</span>
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
          <DriverRouteEstimate route={route} locale={locale}/>
          <button className={styles.primary} disabled={busy} onClick={()=>void action.run()}>
            <MapPin/>{busy?t.drvBusy:action.label}
          </button>
          <div className={styles.secondaryActions}>
            <button type="button" className={styles.mapAction} onClick={openMaps}><Map/>{t.drvOpenMaps}</button>
            <button type="button" className={styles.issueAction} onClick={()=>{
              if(kind==='delivery'){setSheet('delivery');setPodPanel('issue')}
              else {setSheet('pickup');setIssueOpen(true)}
            }}><TriangleAlert/>{t.drvIssue}</button>
          </div>
          <div className={`${styles.returnToAppHint} ${started?styles.returnToAppHintActive:''}`} role="note">
            <strong>{started?(locale==='es'?'Al llegar':'When you arrive'):(locale==='es'?'Siguiente paso':'Next step')}</strong>
            <span>{started
              ? (locale==='es'?`Regresa a RouteHub y presiona “${action.label}” para completar esta parada.`:`Return to RouteHub and press “${action.label}” to complete this stop.`)
              : (locale==='es'?'Comienza la ruta y usa Mapas del teléfono para navegar.':'Start the route, then use your phone\'s Maps app to navigate.')}
            </span>
          </div>
          {message&&!sheet&&<p className={`${styles.feedback}${/could not|failed|pending|error|no se pudo|imposible|add |enter |indica|ajoute/i.test(message)?` ${styles.feedbackError}`:''}`} role="status">{message}</p>}
        </section>
        {nextRoute&&(
          <button type="button" className={styles.nextChip} onClick={()=>setSheet('next')}>
            <NextStopIcon/>
            <span className={styles.nextChipLabel}>
              <small>{locale==='es'?'Siguiente parada':'Next stop'} · {nextLabel}</small>
              <strong>{nextRoute.destination_name||nextRoute.destination_address||t.drvCurrentStopName}</strong>
            </span>
            <ChevronRight size={18}/>
          </button>
        )}
        <button className={styles.routeSwipeZone} type="button" aria-label={nextRoute ? (locale==='es'?'Abrir siguiente ruta':'Open next route') : (locale==='es'?'Ver historial':'View history')} onClick={routeSwipeAction} onTouchStart={routeSwipeStart} onTouchEnd={routeSwipeEnd}>
          <span className={styles.routeSwipeHandle} aria-hidden="true">↑</span>
          <span>{nextRoute ? (locale==='es'?'Desliza hacia arriba para ver la siguiente ruta':'Swipe up for the next route') : (locale==='es'?'No hay más rutas pendientes':'No more pending routes')}</span>
        </button>
      </>:<section className={styles.stateCard}><Package/><h1>{t.drvNoStops}</h1><p>{t.drvAssignedWork}</p></section>}

      {sheet==='info'&&route&&(
        <InfoSheet route={route} kind={kind||'return'} t={t} onClose={()=>setSheet(null)} onOpenMaps={()=>{setSheet(null);openMaps()}}/>
      )}

      {sheet==='pickup'&&route&&(
        <PickupSheet
          route={route} t={t} busy={busy} message={message} issueOpen={issueOpen} issueNote={issueNote}
          onIssueNoteChange={setIssueNote} onSavePickupNote={()=>void savePickupNote()} onConfirmPickup={()=>void confirmPickup()}
          onOpenIssue={()=>setIssueOpen(true)} onClose={()=>{setSheet(null);setIssueOpen(false)}}
        />
      )}

      {sheet==='return'&&route&&(
        <ReturnSheet route={route} t={t} busy={busy} message={message} onComplete={()=>void completeReturnNow()} onClose={()=>setSheet(null)}/>
      )}

      {sheet==='next'&&nextRoute&&(
        <NextStopSheet
          nextRoute={nextRoute} nextKind={nextKind||'return'} nextLabel={nextLabel} t={t} onClose={()=>setSheet(null)}
          onOpenMaps={()=>openMapsForRoute(nextRoute)} onViewHistory={()=>router.push('/driver/history')}
        />
      )}

      {sheet==='delivery'&&route&&(
        <DeliverySheet
          route={route} t={t}
          recipient={recipient} onRecipientChange={value=>{setRecipient(value);if(value.trim())setAskName(false)}}
          photo={photo} photoRef={photoRef} onRequestPhoto={requestPhoto} onPickPhoto={setPhoto}
          signed={signed} podPanel={podPanel} onPodPanelChange={setPodPanel} issueNote={issueNote} onIssueNoteChange={setIssueNote}
          askName={askName} nameFocus={nameFocus} onNameFocus={()=>{setNameFocus(true);setPodPanel(null)}} onNameBlur={()=>setNameFocus(false)} nameRef={nameRef}
          canvas={canvas} onSign={sign} onClearSignature={()=>{const c=canvas.current;if(c)c.getContext('2d')?.clearRect(0,0,c.width,c.height);setSigned(false)}}
          busy={busy} message={message} onConfirm={()=>void confirmDelivery()} onClose={()=>{setSheet(null);setPodPanel(null)}}
        />
      )}

      {confirmPickupOpen&&(
        <div className={confirmStyles.confirmBackdrop} role="dialog" aria-modal="true">
          <div className={confirmStyles.confirmSheet}>
            <h2>{locale==='es'?'¿Completar recogida?':'Complete this pickup?'}</h2>
            <p>{locale==='es'?'Vas a marcar esta parada como completada. No se puede deshacer desde la app.':'This stop will be marked complete. It cannot be undone from the app.'}</p>
            <div className={confirmStyles.confirmActions}>
              <button type="button" className="secondary" disabled={busy} onClick={()=>setConfirmPickupOpen(false)}>{t.drvCancel}</button>
              <button type="button" className="primary" disabled={busy} onClick={()=>{setConfirmPickupOpen(false);void confirmPickup()}}>
                {busy?t.drvBusy:(locale==='es'?'Sí, completar':'Yes, complete')}
              </button>
            </div>
          </div>
        </div>
      )}
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
