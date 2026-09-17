'use client'

import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {Navigation, Package, PackageCheck, PackagePlus, RefreshCw, Truck, Warehouse} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import DriverV3Shell from '../../components/driver-v3/DriverV3Shell'
import {operationalDate} from '../../lib/driver-queue'
import {completeDelivery, completeDeliveryWithRecipient, completePickupWithEvidence, completeReturn, markArrived, reportIssue, saveStopNote, saveStopSignature, startRoute, uploadStopPhoto} from '../../lib/driver-v3/actions'
import {startTemporaryRouteSession} from '../../lib/driving-session'
import {useDriverData} from '../../lib/driver-v3/use-driver-data'
import {openNavigationWithFallback} from '../../lib/maps/external-navigation'
import {getNavigationPreference} from '../../lib/navigation-preference'
import {getDriverModePreference} from '../../lib/driver-mode-preference'
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
const DriverRouteNavigation = dynamic(() => import('../driver-route-navigation'), {ssr: false})
import {Info, MapPin, TriangleAlert} from 'lucide-react'

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

export default function DriverV3Page() {
  const searchParams=useSearchParams()
  const {t,locale}=useLocale()
  const {loading,error,snapshot,driverId,companyId,branchId,refresh,drivingSession,liveFix,offline}=useDriverData()
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
  const autoNavigationRouteRef=useRef<string|null>(null)
  const refreshStartY=useRef<number|null>(null)
  const refreshDistance=useRef(0)
  const completionHandleStartY=useRef<number|null>(null)
  const [refreshing,setRefreshing]=useState(false)
  const [pullDistance,setPullDistance]=useState(0)
  const [navigationVisible,setNavigationVisible]=useState(false)
  // The hero's own route preview map is the visual anchor for the open/close
  // animation - navigation grows out of it instead of hard-swapping the
  // whole screen. navOrigin holds the last measured transform (relative to
  // the full-screen navigation layer) so the closed state can be styled
  // inline without a re-render race against the animation.
  const heroMapRef=useRef<HTMLDivElement|null>(null)
  const navOriginRef=useRef({x:0,y:0,scaleX:1,scaleY:1})
  const captureNavOrigin=()=>{
    const rect=heroMapRef.current?.getBoundingClientRect()
    if(!rect||typeof window==='undefined')return
    const vw=window.innerWidth,vh=window.innerHeight
    navOriginRef.current={
      x:rect.left+rect.width/2-vw/2,
      y:rect.top+rect.height/2-vh/2,
      scaleX:Math.max(rect.width/vw,0.06),
      scaleY:Math.max(rect.height/vh,0.06),
    }
  }
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
  const simpleMode=getDriverModePreference()==='simple'
  const internalNavigationEnabled=started&&getNavigationPreference()==='internal'
  useEffect(()=>{
    if(internalNavigationEnabled)setNavigationVisible(true)
  },[internalNavigationEnabled,route?.id])
  const arrived=phase==='arrived'

  // Settings promises guidance "opens when starting a stop" while the
  // in-app navigator is on, but navigationVisible is plain component state -
  // it used to only turn on from the explicit call inside startCurrent, so a
  // driver who reopens the app mid-route (backgrounded tab, PWA relaunch)
  // landed back on the static route preview instead of resuming live
  // navigation. This restores it once per route per mount whenever the
  // route is already started and the preference is internal. The ref guard
  // means "Volver a Today" (setNavigationVisible(false)) still holds for the
  // rest of that mount instead of snapping back open on the next render.
  useEffect(()=>{
    if(!started||!route?.id)return
    if(getNavigationPreference()!=='internal')return
    if(autoNavigationRouteRef.current===route.id)return
    autoNavigationRouteRef.current=route.id
    captureNavOrigin()
    setNavigationVisible(true)
  },[started,route?.id])
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

  const openPreferredNavigation=()=>{
    if(getNavigationPreference()==='internal'){
      captureNavOrigin()
      setNavigationVisible(true)
    }else openMapsForRoute(route)
  }

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
      // The driver controls this per device: RouteHub navigation stays inside
      // the app, while the external choice invokes Apple Maps/Google Maps.
      openPreferredNavigation()
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

  const arriveFromNavigation=async()=>{
    if(!route||busy||!driverId)return
    setBusy(true)
    setMessage('')
    try{
      if(!route.arrived_at){
        try{await markArrived(ctx())}catch(error){
          if(!/already recorded/i.test(error instanceof Error?error.message:''))throw error
        }
      }
      await refresh()
      captureNavOrigin()
      setNavigationVisible(false)
      if(kind==='pickup'||kind==='delivery'||kind==='return')setSheet(kind)
    }catch(error){
      setMessage(error instanceof Error?error.message:t.drvOpFailed)
    }finally{
      setBusy(false)
    }
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
    const openFlow=kind==='pickup'?async()=>setSheet('pickup'):kind==='return'?openReturn:openDelivery
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
  // showNavLayer mounts the navigator once a stop is started with the
  // in-app preference on - it then stays mounted (GPS watch, voice, wake
  // lock all keep running) for the rest of that stop, so closing back to
  // Today never restarts navigation state, only hides it. navOpen is purely
  // which layer is on top; the animation between them grows out of / shrinks
  // back into the hero's own route preview map (see captureNavOrigin).
  const showNavLayer=Boolean(started&&route&&getNavigationPreference()==='internal')
  const navOpen=Boolean(navigationVisible&&showNavLayer)
  const navigationStops=route?[route,...(snapshot?.queue.upcoming||[])]:[]

  // A CSS transition only animates a value that CHANGES after mount - if
  // navOpen is already true the instant .navLayer first mounts (the normal
  // case: starting a stop opens navigation immediately), there is no prior
  // "closed" frame for the browser to transition from, so it would just pop
  // in already full-size. navEntering forces one closed paint right after
  // mount, then clears on the next frame so the real navOpen value takes
  // over and the grow-from-the-map transition actually plays.
  const [navEntering,setNavEntering]=useState(false)
  useEffect(()=>{
    if(!showNavLayer)return
    setNavEntering(true)
    let raf2=0
    const raf1=requestAnimationFrame(()=>{raf2=requestAnimationFrame(()=>setNavEntering(false))})
    return ()=>{cancelAnimationFrame(raf1);cancelAnimationFrame(raf2)}
  },[showNavLayer])
  const navVisuallyOpen=navOpen&&!navEntering
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
    hideNav={Boolean(navOpen||(sheet && sheet!=='delivery' && operation)||confirmPickupOpen)}
    flush
  >
    <>
    {offline&&<div className={styles.offlineNotice} role="status">{locale==='es'?'Sin conexión · usando la última ruta guardada':'Offline · using the last saved route'}</div>}
    {/* .page and the confirm dialog are siblings, not parent/child, on
        purpose - .pageShrink puts a `transform` on .page while the dialog
        is open, and `transform` on an ancestor turns its `position:fixed`
        descendants into descendants confined to *that* box instead of the
        viewport, which would trap the backdrop inside the very element
        it's meant to shrink behind. .todayStage only exists to give the
        navigation layer below a positioning context to cover - it carries
        no sizing or transform of its own that .pageShrink's ancestor-transform
        concern would apply to. */}
    <div className={styles.todayStage}>
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
          <div
            ref={heroMapRef}
            className={`${styles.routeGlyphHost} ${started?styles.routeGlyphHostCompact:''}`}
            role={showNavLayer?'button':undefined}
            tabIndex={showNavLayer?0:undefined}
            aria-label={showNavLayer?(locale==='es'?'Abrir navegación':locale==='fr'?'Ouvrir la navigation':'Open navigation'):undefined}
            onClick={()=>{if(!showNavLayer||navOpen)return;captureNavOrigin();setNavigationVisible(true)}}
          >
            <DriverRouteMap route={route} driverFix={liveFix?{lat:liveFix.lat,lng:liveFix.lng}:null} locale={locale}/>
            {showNavLayer&&!navOpen&&(
              <span className={styles.mapNavHint}><Navigation size={13}/>{locale==='es'?'Toca para navegar':locale==='fr'?'Touchez pour naviguer':'Tap to navigate'}</span>
            )}
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
          {!simpleMode&&<DriverRouteEstimate route={route} locale={locale} poNumber={kind==='pickup'&&route.order_number?route.order_number:null} simpleNavigation={getNavigationPreference()==='external'}/>} 
          <button type="button" className={styles.primary} data-map-cta disabled={busy} onClick={event=>{event.preventDefault();event.stopPropagation();if(kind==='delivery'&&started)openDelivery();else void action.run()}}>
            {busy?t.drvBusy:action.label}
          </button>
          {/* Maps/Call/Issue only appear once the stop is actually started -
              before that, the only decision that matters is starting, and
              these three animate in together right under the CTA instead
              of hiding behind a separate menu. */}
          {started&&(
            <>
              <div className={`${styles.secondaryRow} ${simpleMode?styles.secondaryRowSimple:''}`}>
                <button type="button" className={styles.secondaryAction} onClick={openPreferredNavigation}>
                  <span className={styles.secondaryActionIcon}><MapPin size={22}/></span>
                  <span>{getNavigationPreference()==='internal'?(locale==='es'?'Continuar navegación':locale==='fr'?'Reprendre la navigation':'Resume navigation'):(locale==='es'?'Abrir navegación del teléfono':locale==='fr'?'Ouvrir la navigation du téléphone':'Open phone navigation')}</span>
                </button>
                {!simpleMode&&<button type="button" className={styles.secondaryAction} onClick={()=>setSheet('info')}>
                  <span className={styles.secondaryActionIcon}><Info size={22}/></span>
                  <span>{locale==='es'?'Info':locale==='fr'?'Infos':'Info'}</span>
                </button>}
                {!simpleMode&&<button type="button" className={`${styles.secondaryAction} ${styles.secondaryActionDanger}`} onClick={openIssueFromTools}>
                  <span className={styles.secondaryActionIcon}><TriangleAlert size={22}/></span>
                  <span>{t.drvIssue}</span>
                </button>}
              </div>
              <span className={styles.startedHandle} role={kind==='delivery'?'button':undefined} aria-label={kind==='delivery'?'Swipe up to complete delivery':undefined} aria-hidden={kind==='delivery'?undefined:'true'} onTouchStart={completionHandleStart} onTouchMove={completionHandleMove} onTouchEnd={completionHandleEnd}/>
            </>
          )}
          {message&&!sheet&&<p className={`${styles.feedback}${/could not|failed|pending|error|no se pudo|imposible|add |enter |indica|ajoute/i.test(message)?` ${styles.feedbackError}`:''}`} role="status">{message}</p>}
        </section>
      </>:<section className={styles.stateCard} aria-live="polite">
        <div className={styles.emptyRouteArt} aria-hidden="true"><span/><i/><b/></div>
        <Package className={styles.emptyRouteIcon}/>
        <h1>{locale==='es'?'Todo listo por ahora':'You’re all caught up'}</h1>
        <p>{t.drvNoStops}</p>
        <button type="button" className={styles.emptyRefresh} onClick={()=>void refreshToday()} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing?styles.spin:''}/>{locale==='es'?'Actualizar rutas':'Refresh routes'}
        </button>
      </section>}

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
    {/* Mounted for the whole started stop, not just while open - see
        showNavLayer above. The inline transform on the closed state mirrors
        the hero map's own rect (captureNavOrigin), so opening/closing reads
        as the navigator growing out of / shrinking back into that map
        instead of one screen replacing another. */}
    {showNavLayer&&(
      <div
        className={styles.navLayer}
        data-open={navVisuallyOpen?'true':'false'}
        style={!navVisuallyOpen?{transform:`translate(${navOriginRef.current.x}px,${navOriginRef.current.y}px) scale(${navOriginRef.current.scaleX},${navOriginRef.current.scaleY})`}:undefined}
        aria-hidden={!navOpen}
      >
        <DriverRouteNavigation
          stops={navigationStops}
          activeStopId={route.id}
          originAddress={route.origin_address}
          originCoordinate={liveFix?{lat:liveFix.lat,lng:liveFix.lng}:null}
          locale={locale}
          sharedLocation={liveFix}
          disabled={busy}
          onArrive={()=>void arriveFromNavigation()}
          onExit={()=>{captureNavOrigin();setNavigationVisible(false)}}
        />
      </div>
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
    </>
  </DriverV3Shell>
}

function TodayLoading({label}:{label:string}) {
  return (
    <div className={styles.loading} aria-label={label}>
      <div className={styles.loadingHero}/>
    </div>
  )
}
