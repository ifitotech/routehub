'use client'

import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {Package, PackageCheck, PackagePlus, Truck, Warehouse} from 'lucide-react'
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
import styles from './today.module.css'
// confirmBackdrop/confirmSheet/confirmActions live in driver-v3-b.module.css -
// the combined driver-v3.module.css only @imports the two split files for
// their raw CSS, it doesn't re-export their class-name maps, so importing
// from it left this dialog with undefined classNames (no backdrop, no fixed
// position, no z-index - it just rendered inline and collided with the card
// and button behind it).
import confirmStyles from '../../components/driver-v3/driver-v3-b.module.css'
import DriverRouteEstimate from '../../components/driver-v3/DriverRouteEstimate'
import {InfoSheet, PickupSheet, ReturnSheet, DeliverySheet} from './today-sheets'
import dynamic from 'next/dynamic'
// MapLibre touches `window` at import time, which breaks static
// prerendering/SSR - load it client-only, same pattern used by every other
// map consumer in this app (driver-route-navigation, compact-map, etc.)
const DriverRouteMap = dynamic(() => import('../../components/driver-v3/DriverRouteMap'), {ssr: false})
import {MapPin, Phone, TriangleAlert, UserRound} from 'lucide-react'

// Driver Today owns only temporary presentation data. A completed route must
// not leave its route geometry behind on this device (nor affect another
// assigned route), so remove just that route's versioned preview entries.
function clearRouteMapPreview(routeId: string) {
  try {
    const prefix = `routehub:map-preview:v1:${routeId}:`
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index)
      if (key?.startsWith(prefix)) window.localStorage.removeItem(key)
    }
  } catch {
    // Private browsing can deny storage access; there is nothing to clean.
  }
}

function shortDestination(value: unknown) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.split(',')[0]?.trim() || text
}

function compactAddress(value: unknown) {
  const parts = String(value || '').split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length <= 2) return parts.join(' · ')
  return `${parts.slice(0, 2).join(', ')} · ${parts.at(-1)}`
}

function formatPhone(value: unknown) {
  const raw = String(value || '').trim()
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return raw
}

export default function DriverV3Page() {
  const router=useRouter()
  const searchParams=useSearchParams()
  const {t,locale}=useLocale()
  const {loading,error,snapshot,driverId,companyId,branchId,refresh,drivingSession,liveFix}=useDriverData()
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
  const refreshStartY=useRef<number|null>(null)
  const refreshDistance=useRef(0)
  const completionHandleStartY=useRef<number|null>(null)
  const [refreshing,setRefreshing]=useState(false)
  const [pullDistance,setPullDistance]=useState(0)
  const operation=snapshot?.currentOperation
  const route=operation?.route as any
  const kind=operation?.kind==='branch'?'return':operation?.kind
  // A shared Package icon for every stop type made the badge/avatar read the
  // same at a glance regardless of what the driver actually has to do next.
  const StopIcon=kind==='pickup'?PackagePlus:kind==='delivery'?PackageCheck:Warehouse
  const currentStopPosition=Math.max(1,Number(route?.position)||1)
  const visibleStopCount=currentStopPosition+(snapshot?.queue.upcoming?.length||0)
  const stopLabel=locale==='es' ? `Parada ${currentStopPosition} de ${visibleStopCount}` : `Stop ${currentStopPosition} of ${visibleStopCount}`
  // Compact, capped at a handful of dots regardless of how many stops are
  // actually left today - real position/count still drive it, this just
  // keeps the row from overflowing a route with a dozen stops.
  const stopDots=Array.from({length: Math.min(visibleStopCount, 5)}, (_, index) => index < currentStopPosition ? (index === currentStopPosition - 1 ? 'current' : 'done') : 'upcoming')
  useEffect(()=>{
    if(!sheet)return
    const html=document.documentElement
    const body=document.body
    html.style.overflow='hidden'
    body.style.overflow='hidden'
    // Always back to '' on cleanup, not whatever was captured before this
    // ran - nothing else in the app sets this property, so there is no
    // legitimate prior value to restore, and restoring a captured value
    // is exactly how a lock could get "stuck" (e.g. re-entrant sheet opens
    // capturing 'hidden' as the "previous" value) and silently carry over
    // to every other screen navigated to afterward, since documentElement/
    // body are global, not scoped to this component.
    return()=>{html.style.overflow='';body.style.overflow=''}
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
      clearRouteMapPreview(String(route.id))
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
      clearRouteMapPreview(String(route.id))
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
      if (!withIssue) clearRouteMapPreview(String(route.id))
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
    photoRef.current?.click()
  }

  // Same branching the old inline "Issue" button used - moved here only
  // because it's now reached through Tools instead of sitting next to the
  // Start/Complete button, not because the flow itself changed.
  const openIssueFromTools=()=>{
    if(kind==='delivery'){setSheet('delivery');setPodPanel('issue')}
    else {setSheet('pickup');setIssueOpen(true)}
  }
  const callFromTools=()=>{
    if(route?.destination_phone) window.location.href=`tel:${String(route.destination_phone).replace(/[^\d+]/g,'')}`
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
    const openFlow=kind==='pickup'?async()=>setConfirmPickupOpen(true):kind==='return'?openReturn:openDelivery
    // Before the driver has actually confirmed arrival, the hero button
    // reads "arrived at stop" rather than "complete X" - tapping it still
    // opens the exact same flow as before (the wording is presentation
    // only), but a driver who is still en route sees an action that
    // matches where they are, not one that jumps straight to "done".
    if(!arrived) return {label:t.drvArrived, run:openFlow}
    if(kind==='pickup') return {label:t.drvCompletePickup, run:openFlow}
    if(kind==='return') return {label:t.drvCompleteReturn, run:openFlow}
    return {label:t.drvCompleteDelivery, run:openFlow}
  }
  const action=primary()
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
  const completionHandleStart=(event:React.TouchEvent<HTMLSpanElement>)=>{
    if(kind!=='delivery'||!started)return
    completionHandleStartY.current=event.touches[0]?.clientY??null
    event.stopPropagation()
  }
  const completionHandleMove=(event:React.TouchEvent<HTMLSpanElement>)=>{
    if(completionHandleStartY.current===null)return
    event.preventDefault()
    event.stopPropagation()
  }
  const completionHandleEnd=(event:React.TouchEvent<HTMLSpanElement>)=>{
    const start=completionHandleStartY.current
    const end=event.changedTouches[0]?.clientY
    completionHandleStartY.current=null
    event.stopPropagation()
    if(start!==null&&end!==undefined&&start-end>28)openDelivery()
  }
  // Keep the primary navigation available on the empty Today state. A stale
  // completion sheet must not hide the nav after the last route is completed.
  // flush (already used by the Map screen) removes .content's own
  // 16px/18px/28px padding entirely - without it, .page's own gradient
  // background only ever painted inside that padding, leaving .content's
  // flat fallback color exposed as a visible frame around the whole hero
  // (map, pill, name, address, CTA) the entire time. .hero's own 18px
  // padding still gives the text/button content the same inset it always
  // had; the map still reaches those same edges via its own negative
  // margins, same as before - now those edges are the screen's true
  // edges instead of edges already inset by .content's padding.
  return <DriverV3Shell
    active="today"
    headerStatus={drivingSession?t.drvDayActive:t.drvDayInactive}
    hideNav={Boolean((sheet && sheet!=='delivery' && operation)||confirmPickupOpen)}
    flush
  >
    {/* .page and the confirm dialog are siblings, not parent/child, on
        purpose - .pageShrink puts a `transform` on .page while the dialog
        is open, and `transform` on an ancestor turns its `position:fixed`
        descendants into descendants confined to *that* box instead of the
        viewport, which would trap the backdrop inside the very element
        it's meant to shrink behind. */}
    <div className={`${styles.page} ${started ? styles.pageStarted : ''} ${(confirmPickupOpen || sheet === 'return' || sheet === 'pickup') ? styles.pageShrink : ''}`} onTouchStart={pullStart} onTouchMove={pullMove} onTouchEnd={pullEnd}>
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
          <div className={`${styles.routeGlyphHost} ${started?styles.routeGlyphHostCompact:''}`}>
            <DriverRouteMap route={route} driverFix={liveFix?{lat:liveFix.lat,lng:liveFix.lng}:null} locale={locale}/>
          </div>
          <div className={styles.heroTop} data-map-details>
            <span className={`${styles.typeBadge} ${styles[kind||'return']}`}><StopIcon/>{kind==='pickup'?t.drvPickup||'PICKUP':kind==='delivery'?t.drvDelivery||'DELIVERY':t.drvReturn||'RETURN'}</span>
          </div>
          <div className={styles.stopMetaRow}>
            <span className={styles.stopLabel}>{stopLabel}</span>
            <span className={styles.stopDots} aria-hidden="true">{stopDots.map((state,index)=><i key={index} className={styles[state]}/>)}</span>
          </div>
          <button type="button" className={styles.identityBlock} onClick={()=>setSheet('info')}>
            <h1>{shortDestination(route.destination_name||route.destination_address)||t.drvCurrentStopName}</h1>
            {route.destination_address&&<p className={styles.addressLine}><MapPin size={15}/><span>{compactAddress(route.destination_address)}</span></p>}
          </button>
          {started&&(route.destination_contact_name||route.destination_phone)&&(
            <div className={styles.contactBlock} data-map-contact>
              <span className={styles.contactLabel}>{locale==='es'?'CONTACTO':'CONTACT'}</span>
              {route.destination_contact_name&&<span className={styles.contactRow}><UserRound size={15}/><strong>{route.destination_contact_name}</strong></span>}
              {route.destination_phone&&<span className={styles.contactRow}><Phone size={15}/><strong>{formatPhone(route.destination_phone)}</strong></span>}
            </div>
          )}
          <DriverRouteEstimate route={route} locale={locale} poNumber={kind==='pickup'&&route.order_number?route.order_number:null}/>
          <button type="button" className={styles.primary} data-map-cta disabled={busy} onClick={event=>{event.preventDefault();event.stopPropagation();if(kind==='delivery'&&started)openDelivery();else void action.run()}}>
            {busy?t.drvBusy:action.label}
          </button>
          {/* Maps/Call/Issue only appear once the stop is actually started -
              before that, the only decision that matters is starting, and
              these three animate in together right under the CTA instead
              of hiding behind a separate menu. */}
          {started&&(
            <>
              <div className={styles.secondaryRow}>
                <button type="button" className={styles.secondaryAction} onClick={openMaps}>
                  <span className={styles.secondaryActionIcon}><MapPin size={22}/></span>
                  <span>{t.drvOpenMaps}</span>
                </button>
                {route.destination_phone&&(
                  <button type="button" className={styles.secondaryAction} onClick={callFromTools}>
                    <span className={styles.secondaryActionIcon}><Phone size={22}/></span>
                    <span>{locale==='es'?'Llamar':locale==='fr'?'Appeler':'Call'}</span>
                  </button>
                )}
                <button type="button" className={`${styles.secondaryAction} ${styles.secondaryActionDanger}`} onClick={openIssueFromTools}>
                  <span className={styles.secondaryActionIcon}><TriangleAlert size={22}/></span>
                  <span>{t.drvIssue}</span>
                </button>
              </div>
              <span className={styles.startedHandle} role={kind==='delivery'?'button':undefined} aria-label={kind==='delivery'?'Swipe up to complete delivery':undefined} aria-hidden={kind==='delivery'?undefined:'true'} onTouchStart={completionHandleStart} onTouchMove={completionHandleMove} onTouchEnd={completionHandleEnd}/>
            </>
          )}
          {message&&!sheet&&<p className={`${styles.feedback}${/could not|failed|pending|error|no se pudo|imposible|add |enter |indica|ajoute/i.test(message)?` ${styles.feedbackError}`:''}`} role="status">{message}</p>}
        </section>
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

      {sheet==='delivery'&&route&&(
        <DeliverySheet
          route={route} t={t}
          recipient={recipient} onRecipientChange={value=>{setRecipient(value);if(value.trim())setAskName(false)}}
          photo={photo} photoRef={photoRef} onRequestPhoto={requestPhoto} onPickPhoto={setPhoto}
          podPanel={podPanel} onPodPanelChange={setPodPanel} issueNote={issueNote} onIssueNoteChange={setIssueNote}
          askName={askName} nameFocus={nameFocus} onNameFocus={()=>{setNameFocus(true);setPodPanel(null)}} onNameBlur={()=>setNameFocus(false)} nameRef={nameRef}
          busy={busy} message={message} onConfirm={()=>void confirmDelivery()} onClose={()=>{setSheet(null);setPodPanel(null)}}
        />
      )}

    </div>
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
  </DriverV3Shell>
}

function TodayLoading({label}:{label:string}) {
  return (
    <div className={styles.loading} aria-label={label}>
      <div className={styles.loadingHero}/>
    </div>
  )
}
