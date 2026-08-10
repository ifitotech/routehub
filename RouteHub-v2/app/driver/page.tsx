'use client'

import Link from 'next/link'
import {useCallback, useEffect, useRef, useState} from 'react'
import {Camera, Check, MapPin, Navigation, Pause, Play, RotateCcw, TriangleAlert, X} from 'lucide-react'
import {completeMission} from '../../lib/data'
import {uploadMissionEvidence} from '../../lib/mission-evidence'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'
import styles from './driver.module.css'
import mapStyles from './driver-map.module.css'

type Mission = {id:string;status:string;origin_address?:string;destination_address?:string;destination_name?:string;priority?:string;notes?:string;position:number;mission_type?:string;order_number?:string;scheduled_at?:string}

function MapPreview({address, origin, title, directions=false}: {address?:string;origin?:string;title:string;directions?:boolean}) {
  if (!address) return <div className={styles.mapEmpty}><MapPin/><span>{title}</span></div>
  const apiKey=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const query=encodeURIComponent(address)
  const directionsUrl=apiKey&&origin
    ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(apiKey)}&origin=${encodeURIComponent(origin)}&destination=${query}&mode=driving`
    : `https://www.google.com/maps?q=${query}&output=embed`
  return <div className={styles.map}><iframe title={title} src={directions?directionsUrl:`https://www.google.com/maps?q=${query}&output=embed`} loading="lazy" allowFullScreen/></div>
}

export default function Driver() {
  const [missions,setMissions]=useState<Mission[]>([])
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [modal,setModal]=useState(false)
  const [issueMode,setIssueMode]=useState(false)
  const [photo,setPhoto]=useState<File|null>(null)
  const [issueNote,setIssueNote]=useState('')
  const fileInput=useRef<HTMLInputElement>(null)
  const {t}=useLocale()

  const load=useCallback(async()=>{try{const client=getSupabase();const {data:userData}=await client.auth.getUser();if(!userData.user)throw Error(t.signIn);const {data,error}=await client.from('routes').select('id,status,origin_address,destination_address,destination_name,priority,notes,position,mission_type,order_number,scheduled_at').eq('driver_id',userData.user.id).in('status',['published','pending','active','paused']).order('position');if(error)throw error;setMissions(data||[]);setMessage('')}catch(error){setMessage(error instanceof Error?error.message:t.unableLoadRoutes)}},[t.signIn,t.unableLoadRoutes])
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

  const current=missions.find(item=>item.status==='active')||missions[0]
  const upcoming=missions.filter(item=>item.id!==current?.id)
  const navigateUrl=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(current?.destination_address||'')}`
  const update=async(status:string)=>{if(!current||busy)return;setBusy(true);try{if(status==='completed'){if(!photo){fileInput.current?.click();return}await uploadMissionEvidence(photo,current.id);await completeMission(current.id)}else{const payload:Record<string,unknown>={status,updated_version:Date.now()};if(status==='issue')payload.notes=[current.notes,issueNote].filter(Boolean).join('\n');const {error}=await getSupabase().from('routes').update(payload).eq('id',current.id);if(error)throw error}setModal(false);setIssueMode(false);setPhoto(null);setIssueNote('');await load()}catch(error){setMessage(error instanceof Error?error.message:t.unableUpdateRoute)}finally{setBusy(false)}}
  const closeModal=()=>{if(busy)return;setModal(false);setIssueMode(false);setIssueNote('');setPhoto(null)}

  return <main className={`app ${styles.page}`}>
    <header className={styles.header}><div><span className={styles.workspace}>{t.driverWorkspace}</span><h1>{t.routes}</h1></div><div className="avatar">DR</div></header>
    {message&&<div className={styles.toast} role="status">{message}</div>}
    {current?<>
      <section className={styles.mission}>
        <div className={styles.missionTop}><span>{t.currentRoute}</span><span className={current.priority==='urgent'?styles.urgent:styles.priority}>{current.priority==='urgent'?`⚠ ${t.urgent}`:current.priority||t.normal}</span></div>
        <div className={styles.type}>{(current.mission_type||'delivery').toUpperCase()} {current.order_number&&<b>#{current.order_number}</b>}</div>
        <h2>{current.destination_name||current.destination_address||t.destination}</h2>
        <p className={styles.address}><MapPin size={18}/>{current.destination_address||t.destination}</p>
        <div className={styles.details}><div><small>{t.origin}</small><strong>{current.origin_address||t.notRecorded}</strong></div><div><small>{t.priorityLabel}</small><strong>{current.priority||t.normal}</strong></div><div className={`${mapStyles.mapCell} ${current.status==='active'?mapStyles.mapCellActive:''}`}><MapPreview address={current.destination_address} origin={current.origin_address} title={t.routeMap} directions={current.status==='active'}/></div></div>
        {current.notes&&<div className={styles.notes}><TriangleAlert size={18}/><span>{current.notes}</span></div>}
      </section>
      <div className={styles.primaryActions}>
        <a className={styles.navigate} href={navigateUrl} target="_blank" rel="noreferrer"><Navigation size={19}/>{t.navigate}</a>
        {['published','pending'].includes(current.status)&&<button disabled={busy} className={styles.start} onClick={()=>void update('active')}><Play size={19}/>{t.start}</button>}
        {current.status==='active'&&<button disabled={busy} className={styles.complete} onClick={()=>setModal(true)}><Check size={19}/>{t.complete}</button>}
        {current.status==='paused'&&<button disabled={busy} className={styles.start} onClick={()=>void update('active')}><RotateCcw size={19}/>{t.resume}</button>}
      </div>
      {current.status==='active'&&<div className={styles.secondaryActions}><button disabled={busy} onClick={()=>void update('paused')}><Pause size={18}/>{t.pause}</button><button onClick={()=>{setIssueMode(true);setModal(true)}}><TriangleAlert size={18}/>{t.reportProblem}</button></div>}
      <section className={styles.next}><div className={styles.sectionTitle}><span>{t.nextRoute}</span><b>{upcoming.length}</b></div>{upcoming.length?upcoming.slice(0,3).map((item,index)=><article key={item.id}><span className={styles.number}>{index+2}</span><div><small>{(item.mission_type||'delivery').toUpperCase()}</small><strong>{item.destination_name||item.destination_address||t.destination}</strong><span>{item.destination_address}</span></div><span className={item.priority==='urgent'?styles.urgentDot:styles.dot}/></article>):<div className={styles.noNext}>{t.noNext}</div>}</section>
    </>:<section className={`card ${styles.empty}`}><MapPin/><h2>{t.noRoute}</h2><p>{t.noRouteHelp}</p></section>}
    {modal&&<div className={styles.backdrop} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closeModal()}}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="complete-title"><button className={styles.close} aria-label={t.close} onClick={closeModal}><X/></button><div className={issueMode?styles.modalDanger:styles.modalIcon}>{issueMode?<TriangleAlert/>:<Camera/>}</div><h2 id="complete-title">{issueMode?t.couldNotDeliver:t.complete}</h2><p>{issueMode?t.reason:t.photo}</p>{issueMode?<><textarea autoFocus value={issueNote} onChange={event=>setIssueNote(event.target.value)} placeholder={t.reason}/><button className={styles.issueButton} disabled={!issueNote.trim()||busy} onClick={()=>void update('issue')}>{t.saveIssue}</button></>:<><input ref={fileInput} hidden type="file" accept="image/*" capture="environment" onChange={event=>setPhoto(event.target.files?.[0]||null)}/><button className={styles.photoButton} disabled={busy} onClick={()=>photo?void update('completed'):fileInput.current?.click()}><Camera/>{photo?t.completeWithPhoto:t.addPhoto}</button>{photo&&<small className={styles.fileName}>{photo.name}</small>}<button className={styles.issueLink} onClick={()=>setIssueMode(true)}>{t.couldNotDeliver}</button></>}</section></div>}
    <nav className="nav"><Link href="/driver">{t.home}</Link><Link href="/driver/history">{t.history}</Link><Link href="/driver/settings">{t.settings}</Link></nav>
  </main>
}
