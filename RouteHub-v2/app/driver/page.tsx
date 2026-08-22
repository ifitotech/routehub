'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import {useCallback, useEffect, useRef, useState} from 'react'
import {ArrowLeft, Camera, Check, ChevronRight, CircleUserRound, History as HistoryIcon, Home, List, MapPin, Pause, Play, RotateCcw, TriangleAlert, X} from 'lucide-react'
import {completeMission, currentMembership} from '../../lib/data'
import {uploadMissionEvidence} from '../../lib/mission-evidence'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'
import {endDrivingDay, getActiveDrivingSession, startDrivingDay, startTemporaryRouteSession, updateDrivingLocation, type DrivingSession} from '../../lib/driving-session'
import {getCurrentLocation, getLocationPermission} from '../../lib/location'
import {canDriverStartRoute, operationalDate, selectDriverTodayQueue} from '../../lib/driver-queue'
import {workspaceForStrictRole} from '../auth-access'
import type {Role} from '../../lib/types'
import NotificationBell from '../notification-bell'
import styles from './driver.module.css'
const LiveRouteMap=dynamic(()=>import('../live-route-map'),{ssr:false})

type Mission = {id:string;company_id:string;branch_id:string|null;driver_id:string;route_date:string;status:'draft'|'pending'|'published'|'active'|'paused'|'completed'|'issue'|'cancelled';origin_address?:string;destination_address?:string;destination_name?:string;priority?:string;notes?:string;position:number;mission_type?:string;order_number?:string;scheduled_at?:string;completed_at?:string}

const errorMessage=(error:unknown,fallback:string)=>{
  if(error instanceof Error&&error.message)return error.message
  if(error&&typeof error==='object'&&'message' in error&&typeof error.message==='string'&&error.message)return error.message
  return fallback
}

export default function Driver() {
  const [missions,setMissions]=useState<Mission[]>([])
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [modal,setModal]=useState(false)
  const [issueMode,setIssueMode]=useState(false)
  const [issueNote,setIssueNote]=useState('')
  const [driverId,setDriverId]=useState('')
  const [membershipRole,setMembershipRole]=useState<Role|null>(null)
  const [drivingSession,setDrivingSession]=useState<DrivingSession|null>(null)
  const [locationStatus,setLocationStatus]=useState('')
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState('')
  const [routeView,setRouteView]=useState<'queue'|'details'|'map'|null>(null)
  const [selectedRouteId,setSelectedRouteId]=useState<string | null>(null)
  const [dayPromptOpen,setDayPromptOpen]=useState(false)
  const dayPromptSeenRef=useRef(false)
  const fileInput=useRef<HTMLInputElement>(null)
  const {t,locale}=useLocale()

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const client=getSupabase()
      const {data:userData}=await client.auth.getUser()
      if(!userData.user)throw Error(t.signIn)
      const today=operationalDate()
      setDriverId(userData.user.id)
      const membership=await currentMembership()
      setMembershipRole(membership.role as Role)
      // route_date is the operational date. Never use created_at or a UTC
      // conversion here: tomorrow's position 1 must not become today's route.
      const {data,error}=await client.from('routes')
        .select('id,company_id,branch_id,driver_id,route_date,status,origin_address,destination_address,destination_name,priority,notes,position,mission_type,order_number,scheduled_at,completed_at')
        .eq('driver_id',userData.user.id)
        .in('status',['published','pending','active','paused','issue'])
        .order('position')
      if(error)throw error
      setMissions((data||[]) as Mission[])
      const sessionResult=await getActiveDrivingSession(userData.user.id)
      if(!sessionResult.error){
        setDrivingSession(sessionResult.data)
        if(membership.role==='driver'&&!sessionResult.data&&!dayPromptSeenRef.current){dayPromptSeenRef.current=true;setDayPromptOpen(true)}
      }
      setLoadError('')
      setMessage('')
    }catch(error){
      // Keep the last authoritative queue on screen during a temporary
      // connection failure. Detailed errors stay in development tools only.
      if(process.env.NODE_ENV !== 'production')console.error('Driver route queue failed to load',error)
      setLoadError(t.unableLoadRoutes)
    }finally{setLoading(false)}
  },[t.signIn,t.unableLoadRoutes])
  const today=operationalDate()
  const {current,upcoming,completed}=selectDriverTodayQueue(missions,driverId,today)
  const selectedRoute=[current,...upcoming,...completed].find(item=>item?.id===selectedRouteId) || current
  const taskLabels:Record<string,string>={pickup:t.pickup,delivery:t.delivery,return:'Return to branch',transfer:'Custom route'}
  const currentTask=taskLabels[current?.mission_type||'delivery']||t.delivery
  const temporaryExecution=membershipRole!=null&&membershipRole!=='driver'
  const homeHref=membershipRole?workspaceForStrictRole(membershipRole):'/driver'
  const temporaryLabel=locale==='es'?'Ruta temporal':locale==='fr'?'Itinéraire temporaire':'Temporary route'
  const isPastRoute=Boolean(current?.route_date&&current.route_date.slice(0,10)<today)

  useEffect(()=>{
    const client=getSupabase()
    let disposed=false
    let channel:ReturnType<typeof client.channel>|undefined
    const refresh=()=>{if(!disposed)void load()}
    void client.auth.getUser().then(({data})=>{
      if(disposed||!data.user)return
      channel=client.channel(`driver-routes-${data.user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'routes',filter:`driver_id=eq.${data.user.id}`},refresh).subscribe()
    })
    refresh()
    const timer=setInterval(refresh,10000)
    const onVisibility=()=>{if(document.visibilityState==='visible')refresh()}
    window.addEventListener('focus',refresh)
    document.addEventListener('visibilitychange',onVisibility)
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',onVisibility);if(channel)void client.removeChannel(channel)}
  },[load])

  useEffect(()=>{
    if(!drivingSession||!driverId||typeof navigator==='undefined'||!navigator.geolocation)return
    let disposed=false
    const sendLocation=async()=>{
      try{
        // Only the driver's explicit Start route action can request location.
        // The five-minute sample never reopens a permission prompt.
        const permission=await getLocationPermission()
        if(permission!=='granted'){
          if(permission==='denied'&&!disposed)setLocationStatus(t.locationPermissionDenied)
          return
        }
        const location=await getCurrentLocation({maximumAge:4*60*1000})
        if(disposed)return
        const result=await updateDrivingLocation(drivingSession.id,driverId,location)
        if(result.error)throw result.error
        setLocationStatus('')
      }catch(error){if(!disposed)setLocationStatus(error instanceof Error?error.message:t.locationPermissionDenied)}
    }
    // Location is intentionally sampled, rather than continuously watched:
    // one update now and one every five minutes during an active driving day.
    // Safari may suspend a PWA in the background; the manager then sees the
    // genuine last-updated time instead of a fabricated moving location.
    void sendLocation()
    const interval=window.setInterval(()=>void sendLocation(),5*60*1000)
    return()=>{disposed=true;window.clearInterval(interval)}
  },[driverId,drivingSession,t.locationPermissionDenied])

  const navigateUrl=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(current?.destination_address||'')}`
  const startTrackingForActiveRoute=async()=>{
    if(!driverId||!current)return false
    try{
      const coordinates=await getCurrentLocation()
      const membership=await currentMembership()
      const result=membership.role==='driver'
        ? await startDrivingDay({companyId:current.company_id||membership.company_id,branchId:current.branch_id??membership.branch_id,driverId})
        : await startTemporaryRouteSession({companyId:current.company_id||membership.company_id,branchId:current.branch_id??membership.branch_id,driverId,routeId:current.id})
      if(result.error)throw result.error
      setDrivingSession(result.data)
      if(result.data)await updateDrivingLocation(result.data.id,driverId,coordinates)
      setLocationStatus('')
      return true
    }catch(error){setLocationStatus(error instanceof Error?error.message:t.locationPermissionDenied);return false}
  }
  const beginDrivingDay=async()=>{
    if(!driverId||busy)return
    setBusy(true);setLocationStatus('')
    try{
      const membership=await currentMembership()
      const coordinates=await getCurrentLocation()
      const result=await startDrivingDay({companyId:membership.company_id,branchId:current?.branch_id??membership.branch_id,driverId})
      if(result.error)throw result.error
      setDrivingSession(result.data)
      if(result.data)await updateDrivingLocation(result.data.id,driverId,coordinates)
      setMessage(t.startDrivingDay)
      setDayPromptOpen(false)
    }catch(error){setLocationStatus(error instanceof Error?error.message:t.locationPermissionDenied);setMessage(error instanceof Error?error.message:t.unableUpdateRoute)}
    finally{setBusy(false)}
  }
  const finishDrivingDay=async()=>{
    if(!drivingSession||busy)return
    setBusy(true)
    try{const result=await endDrivingDay(drivingSession.id,driverId);if(result.error)throw result.error;setDrivingSession(null);setLocationStatus('');setMessage(t.endDrivingDay)}catch(error){setLocationStatus(error instanceof Error?error.message:t.unableUpdateRoute)}finally{setBusy(false)}
  }

  const update=async(status:string)=>{
    if(!current||busy)return false
    setBusy(true)
    try{
      if(status==='completed'){fileInput.current?.click();return false}
      if(status==='active'&&!canDriverStartRoute(current,today)){setMessage(t.unableUpdateRoute);return false}
      const client=getSupabase()
      if(status==='active'){
        const {data:otherActive,error:activeError}=await client.from('routes').select('id').eq('driver_id',driverId).eq('company_id',current.company_id).eq('status','active').neq('id',current.id)
        if(activeError)throw activeError
        if(otherActive?.length){
          const {error:pauseError}=await client.from('routes').update({status:'paused',updated_version:Date.now()}).in('id',otherActive.map(route=>route.id)).eq('driver_id',driverId).eq('company_id',current.company_id)
          if(pauseError)throw pauseError
        }
      }
      const payload:Record<string,unknown>={status,updated_version:Date.now()}
      if(status==='issue')payload.notes=[current.notes,issueNote].filter(Boolean).join('\n')
      const {error}=await client.from('routes').update(payload).eq('id',current.id).eq('driver_id',driverId).eq('company_id',current.company_id)
      if(error)throw error
      if(status==='active')await startTrackingForActiveRoute()
      setModal(false);setIssueMode(false);setIssueNote('');await load();return true
    }catch(error){setMessage(errorMessage(error,t.unableUpdateRoute));return false}
    finally{setBusy(false)}
  }
  const completeWithPhoto=async(file:File)=>{if(!current||busy)return;setBusy(true);try{await uploadMissionEvidence(file,current.id);let completionLocation:Awaited<ReturnType<typeof getCurrentLocation>>|undefined;try{completionLocation=await getCurrentLocation({maximumAge:60_000});if(drivingSession)await updateDrivingLocation(drivingSession.id,driverId,completionLocation)}catch{}await completeMission(current.id,completionLocation);setModal(false);setIssueMode(false);setIssueNote('');setMessage(t.complete);await load()}catch(error){setMessage(error instanceof Error?error.message:t.unableUpdateRoute)}finally{setBusy(false)}}
  const completeWithGPS=async()=>{if(!current||busy)return;setBusy(true);try{const location=await getCurrentLocation({maximumAge:60_000});if(drivingSession)await updateDrivingLocation(drivingSession.id,driverId,location);await completeMission(current.id,location);setMessage(t.complete);await load()}catch(error){setMessage(error instanceof Error?error.message:t.unableUpdateRoute)}finally{setBusy(false)}}
  const startRoute=async()=>{
    // Do not use window.open here: Safari and installed PWAs can treat it as
    // a pop-up and ignore the driver's tap. A same-tab navigation is reliable
    // and lets the device hand the URL to Google Maps when it is installed.
    const saved=current?.status==='active'
      ? (drivingSession ? true : await startTrackingForActiveRoute())
      : await update('active')
    if(!saved)return
    setMessage(t.inProgress)
    window.location.assign(navigateUrl)
  }
  const closeModal=()=>{if(busy)return;setModal(false);setIssueMode(false);setIssueNote('')}

  return <main className={`app ${styles.page}`}>
    <header className={styles.header}><div className={styles.brand}><Image src="/routehub-driver-new.jpg" alt="RouteHub Driver" width={48} height={48} priority/><strong>RouteHub</strong></div><NotificationBell /></header><div className={styles.workspaceHeading}><span className={styles.workspace}>{t.driverWorkspace}</span><h1>{t.routes}</h1></div>
    {membershipRole==='driver'&&<div className={styles.drivingBar}>{drivingSession?<><span className={styles.locationLive}><i/>{t.locationSharing}</span><button className={styles.endDay} disabled={busy} onClick={()=>void finishDrivingDay()}>{t.endDrivingDay}</button></>:<button className={styles.startDay} disabled={busy} onClick={()=>void beginDrivingDay()}><Play size={16}/>{t.startDrivingDay}</button>}</div>}
    {temporaryExecution&&drivingSession&&<div className={styles.drivingBar}><span className={styles.locationLive}><i/>{temporaryLabel}</span></div>}
    {locationStatus&&<div className={styles.toast} role="status">{locationStatus}</div>}
    {message&&<div className={styles.toast} role="status">{message}</div>}
    {loadError&&<div className={styles.loadError} role="status"><span>{loadError}</span><button disabled={loading} onClick={()=>void load()}>{t.retry || 'Retry'}</button></div>}
    {loading&&!missions.length?<section className={`${styles.loading} card`} aria-busy="true"><span/><span/><span/></section>:current?<>
      <section className={styles.routeHero}>
      <section className={styles.mission}>
        <div className={styles.missionTop}><span>{isPastRoute?'PAST DUE':t.currentRoute}</span><span className={current.priority==='urgent'?styles.urgent:styles.priority}>{isPastRoute?'PENDING':current.priority==='urgent'?`⚠ ${t.urgent}`:current.priority||t.normal}</span></div>
        <div className={styles.type}>{(current.mission_type||'delivery').toUpperCase()} {current.order_number&&<b>#{current.order_number}</b>}</div>
        <h2>{current.destination_name||current.destination_address||t.destination}</h2>
        <p className={styles.address}><MapPin size={18}/>{current.destination_address||t.destination}</p>
        <div className={styles.details}><div><small>{t.origin}</small><strong>{current.origin_address||t.notRecorded}</strong></div><div><small>{t.type}</small><strong>{currentTask}</strong></div></div>
        {current.notes&&<div className={styles.notes}><TriangleAlert size={18}/><span>{current.notes}</span></div>}
      </section>
      {current.status==='active'&&<LiveRouteMap originAddress={current.origin_address} destinationAddress={current.destination_address} driverLocation={drivingSession?.last_lat!=null&&drivingSession?.last_lng!=null?{lat:drivingSession.last_lat,lng:drivingSession.last_lng}:null} driverUpdatedAt={drivingSession?.last_updated_at} title="Ruta en vivo" showHeader={false} showLocationUpdated={false} interactive={false}/>} 
      </section>
      <div className={styles.primaryActions}>
        {['published','pending'].includes(current.status)&&<button disabled={busy} className={styles.start} onClick={()=>void startRoute()}><Play size={19}/>{t.start}</button>}
        {current.status==='active'&&<button disabled={busy} className={styles.viewRoute} onClick={()=>setRouteView('map')}><MapPin size={18}/>{t.openGoogleMaps}</button>}
        {current.status==='active'&&<button disabled={busy} className={styles.complete} onClick={()=>void completeWithGPS()}><Check size={19}/>{t.complete}</button>}
        {current.status==='paused'&&<button disabled={busy} className={styles.start} onClick={()=>void update('active')}><RotateCcw size={19}/>{t.resume}</button>}
      </div>
      {current.status==='active'&&<div className={styles.secondaryActions}><button disabled={busy} onClick={()=>void update('paused')}><Pause size={18}/>{t.pause}</button><button onClick={()=>{setIssueMode(true);setModal(true)}}><TriangleAlert size={18}/>{t.reportProblem}</button></div>}
      <section className={styles.next}><div className={styles.sectionTitle}><span>{t.nextRoute}</span><b>{upcoming.length}</b></div>{upcoming.length?<div className={styles.nextList}>{upcoming.map((item,index)=><article key={item.id}><span className={styles.number}>{index+2}</span><div><small>{(item.mission_type||'delivery').toUpperCase()}</small><strong>{item.destination_name||item.destination_address||t.destination}</strong><span>{item.destination_address}</span></div><span className={item.priority==='urgent'?styles.urgentDot:styles.dot}/></article>)}</div>:<div className={styles.noNext}>{t.noNext}</div>}</section>
      {completed.length>0&&<section className={styles.completed}><div className={styles.sectionTitle}><span>{t.completed}</span><b>{completed.length}</b></div>{completed.slice(0,2).map(item=><article key={item.id}><Check size={15}/><span>{item.destination_name||item.destination_address||t.destination}</span></article>)}</section>}
    </>:<section className={`card ${styles.empty}`}><MapPin/><h2>{t.noRoute}</h2><p>{t.noRoutesAssignedToday || t.noRouteHelp}</p>{temporaryExecution&&<Link className="primary" href={homeHref}>{locale==='es'?'Volver al espacio de trabajo':locale==='fr'?`Retour à l'espace de travail`:'Return to workspace'}</Link>}</section>}
    {routeView&&current&&<section className={styles.routeOverlay} aria-label="Route details">
      <header className={styles.routeOverlayHeader}><button type="button" onClick={()=>routeView==='details'?setRouteView('queue'):setRouteView(null)} aria-label="Back"><ArrowLeft size={20}/></button><strong>{routeView==='details'?'Stop details':'Route'}</strong><span /></header>
      {routeView==='queue'?<><div className={styles.routeTabs}><button className={styles.routeTabActive} type="button">Stops</button><button type="button" onClick={()=>current.status==='active'&&window.location.assign(navigateUrl)}>Map</button></div><div className={styles.stopList}>{[current,...upcoming].filter(Boolean).map((route,index)=><button type="button" className={styles.stopRow} key={route.id} onClick={()=>{setSelectedRouteId(route.id);setRouteView('details')}}><span className={styles.stopNumber}>{index+1}</span><span><strong>{route.destination_name||route.destination_address||t.destination}</strong><small>{(route.mission_type||'delivery').toUpperCase()} · {route.status==='active'?'In progress':route.scheduled_at?new Date(route.scheduled_at).toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'}):'Upcoming'}</small></span><ChevronRight size={18}/></button>)}</div></>:selectedRoute&&<div className={styles.stopDetails}><span className={styles.stopNumber}>{selectedRoute.position}</span><h2>{selectedRoute.destination_name||selectedRoute.destination_address||t.destination}</h2><p><MapPin size={17}/>{selectedRoute.destination_address||t.destination}</p><div className={styles.detailDivider}/><small>{(selectedRoute.mission_type||'delivery').toUpperCase()}</small><strong>{selectedRoute.status==='active'?'Current stop':selectedRoute.status==='completed'?t.completed:'Upcoming stop'}</strong>{selectedRoute.notes&&<p className={styles.detailNotes}>{selectedRoute.notes}</p>}{selectedRoute.id===current.id&&current.status==='active'&&<button className={styles.complete} type="button" onClick={()=>{setRouteView(null);setModal(true)}}><Check size={18}/>{t.complete}</button>}</div>}</section>}
    {modal&&<div className={styles.backdrop} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closeModal()}}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="complete-title"><button className={styles.close} aria-label={t.close} onClick={closeModal}><X/></button><div className={issueMode?styles.modalDanger:styles.modalIcon}>{issueMode?<TriangleAlert/>:<Camera/>}</div><h2 id="complete-title">{issueMode?t.couldNotDeliver:t.complete}</h2><p>{issueMode?t.reason:t.photo}</p>{issueMode?<><textarea autoFocus value={issueNote} onChange={event=>setIssueNote(event.target.value)} placeholder={t.reason}/><button className={styles.issueButton} disabled={!issueNote.trim()||busy} onClick={()=>void update('issue')}>{t.saveIssue}</button></>:<><input ref={fileInput} hidden type="file" accept="image/*" capture="environment" onChange={event=>{const file=event.target.files?.[0];event.currentTarget.value='';if(file)void completeWithPhoto(file)}}/><button className={styles.photoButton} disabled={busy} onClick={()=>fileInput.current?.click()}><Camera/>{t.completeWithPhoto}</button><button className={styles.issueLink} onClick={()=>setIssueMode(true)}>{t.couldNotDeliver}</button></>}</section></div>}
    {dayPromptOpen&&membershipRole==='driver'&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="day-start-title"><div className={styles.modalIcon}><Play/></div><h2 id="day-start-title">Start your driving day</h2><p>You have <strong>{missions.filter(item=>['published','pending','active','paused'].includes(item.status)).length}</strong> route{missions.filter(item=>['published','pending','active','paused'].includes(item.status)).length===1?'':'s'} assigned for today.</p><button className={styles.photoButton} disabled={busy} onClick={()=>void beginDrivingDay()}><Play/>{busy?'Starting…':'Start day and share location'}</button><button className={styles.issueLink} disabled={busy} onClick={()=>{dayPromptSeenRef.current=true;setDayPromptOpen(false)}}>Not now</button></section></div>}
    <nav className={styles.driverNav} aria-label="Driver navigation"><button type="button" aria-current={!routeView?'page':undefined} onClick={()=>setRouteView(null)}><Home size={18}/><span>Today</span></button><button type="button" aria-current={routeView?'page':undefined} onClick={()=>current&&setRouteView('queue')}><List size={18}/><span>Route</span></button><Link href="/driver/history"><HistoryIcon size={18}/><span>{t.history}</span></Link><Link href="/driver/settings"><CircleUserRound size={18}/><span>Profile</span></Link></nav>
  </main>
}
