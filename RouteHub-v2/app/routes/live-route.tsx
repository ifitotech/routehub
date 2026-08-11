'use client'

import Link from 'next/link'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {ArrowRight, MapPin, Navigation, Radio, Route as RouteIcon} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {formatLocationAge, loadActiveDrivingSessions, type DrivingSession} from '../../lib/driving-session'
import {useLocale} from '../../lib/use-preferences'
import styles from './live-route.module.css'

type LiveRouteRecord = {id:string;driver_id:string|null;mission_type:string|null;status:string|null;destination_name:string|null;destination_address:string|null;origin_address:string|null;scheduled_at:string|null;route_date:string|null;position:number|null;priority:string|null}
type Person = {user_id:string;email:string|null}

function todayValue() { const now=new Date(); return new Date(now.getTime()-now.getTimezoneOffset()*60_000).toISOString().slice(0,10) }
function routeType(value:string|null|undefined,t:Record<string,string>) { return value==='pickup'?t.pickup:value==='delivery'?t.delivery:value==='transfer'?t.transfer:value==='return'?t.return:t.route }
function timeLabel(value:string|null|undefined) { if(!value)return ''; const date=new Date(value); return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(date) }
function personName(email:string|null|undefined) { if(!email)return 'Team member'; const name=email.split('@')[0].replace(/[._-]+/g,' ').trim(); return name?name.replace(/\b\w/g,char=>char.toUpperCase()):email }

export default function LiveRoute({companyId,branchId,expanded=false}:{companyId:string;branchId?:string|null;expanded?:boolean}) {
  const {t}=useLocale()
  const [sessions,setSessions]=useState<DrivingSession[]>([])
  const [routes,setRoutes]=useState<LiveRouteRecord[]>([])
  const [people,setPeople]=useState<Person[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [selectedDriver,setSelectedDriver]=useState<string|null>(null)

  const load=useCallback(async()=>{
    if(!companyId)return
    setLoading(true)
    try {
      const client=getSupabase()
      const [sessionResult,routeResult,peopleResult]=await Promise.all([
        loadActiveDrivingSessions(companyId,branchId),
        client.from('routes').select('id,driver_id,mission_type,status,destination_name,destination_address,origin_address,scheduled_at,route_date,position,priority').eq('company_id',companyId).in('status',['published','pending','active','paused']).order('position'),
        client.from('company_users').select('user_id,users(email)').eq('company_id',companyId),
      ])
      if(sessionResult.error)throw sessionResult.error
      if(routeResult.error)throw routeResult.error
      if(peopleResult.error)throw peopleResult.error
      setSessions(sessionResult.data)
      setRoutes((routeResult.data||[]) as LiveRouteRecord[])
      const users=(peopleResult.data||[]).map((row:{user_id:string;users:{email?:string|null}|{email?:string|null}[]|null})=>({user_id:row.user_id,email:Array.isArray(row.users)?row.users[0]?.email||null:row.users?.email||null}))
      setPeople(users)
      setSelectedDriver(current=>current&&sessionResult.data.some(item=>item.driver_id===current)?current:sessionResult.data[0]?.driver_id||null)
      setError('')
    } catch(cause) { setError(cause instanceof Error?cause.message:'Unable to load live route.') }
    finally { setLoading(false) }
  },[branchId,companyId])

  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    if(!companyId)return
    const client=getSupabase(); let disposed=false
    const refresh=()=>{if(!disposed)void load()}
    const channel=client.channel(`live-route-${companyId}`).on('postgres_changes',{event:'*',schema:'public',table:'driving_sessions',filter:`company_id=eq.${companyId}`},refresh).on('postgres_changes',{event:'*',schema:'public',table:'routes',filter:`company_id=eq.${companyId}`},refresh).subscribe()
    const timer=window.setInterval(refresh,30000)
    return()=>{disposed=true;window.clearInterval(timer);void client.removeChannel(channel)}
  },[companyId,load])

  const selected=sessions.find(item=>item.driver_id===selectedDriver)||sessions[0]
  const selectedRoute=selected?routes.filter(item=>item.driver_id===selected.driver_id).sort((a,b)=>Number(a.position||0)-Number(b.position||0)).find(item=>['active','published','pending','paused'].includes(item.status||'')):undefined
  const hasLocation=selected?.last_lat!=null&&selected?.last_lng!=null
  const labels=useMemo(()=>new Map(people.map(person=>[person.user_id,personName(person.email)])),[people])
  const todayRoutes=useMemo(()=>routes.filter(route=>{const date=route.route_date||(route.scheduled_at?route.scheduled_at.slice(0,10):'');return date===todayValue()}).sort((a,b)=>Number(a.position||0)-Number(b.position||0)),[routes])
  const visibleToday=todayRoutes.slice(0,expanded?50:5)

  if(!companyId)return null
  return <>
    <section className={`${styles.section} ${expanded?styles.expanded:''}`} aria-labelledby="live-route-title">
      <div className={styles.sectionHeader}><h2 id="live-route-title">{t.liveRoute}</h2>{sessions.length>0&&<span className={styles.liveBadge}><i/>{t.live} · {sessions.length}</span>}</div>
      {error&&<p className="muted" role="status">{error}</p>}
      {loading?<div className={styles.empty}><Radio size={18}/><span>{t.loading}</span></div>:sessions.length===0?<div className={styles.empty}><MapPin size={20}/><div><strong>{t.noLiveRoutes}</strong><span>{t.driverLocationWillAppear}</span></div></div>:<>
        {sessions.length>1&&<div className={styles.people} aria-label={t.driver}>{sessions.map(session=><button className={`${styles.person} ${session.driver_id===selected?.driver_id?styles.personActive:''}`} key={session.id} onClick={()=>setSelectedDriver(session.driver_id)}>{labels.get(session.driver_id)||t.driver}</button>)}</div>}
        <Link className={styles.mapCard} href="/routes/live" aria-label={t.mapOpen}>
          <div className={styles.map}><span className={styles.mapLabel}><Navigation size={14}/>{t.live}</span><div className={styles.driverOverlay}><span className={styles.driverAvatar}><Radio size={16}/></span><span className={styles.driverOverlayText}><strong>{labels.get(selected?.driver_id||'')||t.driver}</strong><small>{t.driver} {selectedRoute?`· ${routeType(selectedRoute.mission_type,t)}`:''}</small></span><span className={styles.overlayStatus}>{hasLocation?t.live:t.locationUnavailable}</span></div>{hasLocation?<><span className={`${styles.marker} ${styles.driverMarker}`}/><span className={`${styles.markerLabel} ${styles.driverLabel}`}>{labels.get(selected?.driver_id||'')||t.driver}</span><span className={styles.routePath}/></>:<span className={styles.locationUnavailable}>{t.locationUnavailable}</span>}{selectedRoute&&<><span className={`${styles.marker} ${styles.destinationMarker}`}/><span className={`${styles.markerLabel} ${styles.destinationLabel}`}>{selectedRoute.destination_name||selectedRoute.destination_address||t.destination}</span></>}</div>
          <div className={styles.mapFooter}><div className={styles.liveSummary}><strong>{labels.get(selected?.driver_id||'')||t.driver} · {t.driver}</strong><span>{routeType(selectedRoute?.mission_type,t)} <ArrowRight size={12}/> {selectedRoute?.destination_name||selectedRoute?.destination_address||t.currentDestination}</span></div><span className={styles.lastUpdate}>{formatLocationAge(selected?.last_updated_at,Date.now(),{unavailable:t.locationUnavailable,justNow:t.updatedJustNow,minute:`${t.lastUpdated} 1 min ago`,minutes:`${t.lastUpdated} {n} min ago`,hours:`${t.lastUpdated} {n} hr ago`})}</span></div>
        </Link>
        {hasLocation&&selected&&<div className={styles.locationReadout} role="status"><span className={styles.locationDot}/><strong>{labels.get(selected.driver_id)||t.driver}</strong><span>Live location{selected.last_accuracy!=null?` · ±${Math.round(selected.last_accuracy)} m`:''}</span></div>}
      </>}
    </section>
    <section className={styles.today} aria-labelledby="today-routes-title"><div className={styles.sectionHeader}><h2 id="today-routes-title">{t.today}</h2></div>{visibleToday.length===0?<div className={styles.empty}><RouteIcon size={20}/><div><strong>{t.noRoutesToday}</strong><span>{t.createRouteWhenReady}</span></div></div>:<div className={styles.todayList}>{visibleToday.map(route=><div className={styles.todayRow} data-status={route.status||'pending'} key={route.id}><span className={styles.todayIcon}>{route.status==='completed'?'✓':route.status==='active'?'●':'○'}</span><div className={styles.todayText}><strong>{routeType(route.mission_type,t)} · {route.destination_name||route.destination_address||t.destination}</strong><span>{route.status||t.pending}{route.priority==='urgent'?' · '+t.urgent:''}</span></div><span className={styles.todayTime}>{timeLabel(route.scheduled_at)}</span></div>)}</div>}{todayRoutes.length>visibleToday.length&&<Link className={styles.viewAll} href="/routes/manage">{t.viewAll}<ArrowRight size={14}/></Link>}</section>
  </>
}
