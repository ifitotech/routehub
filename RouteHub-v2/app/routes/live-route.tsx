'use client'

import Link from 'next/link'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {ArrowRight, ExternalLink, MapPin, Navigation, Radio, Route as RouteIcon} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {formatLocationAge, loadActiveDrivingSessions, type DrivingSession} from '../../lib/driving-session'
import {useLocale} from '../../lib/use-preferences'
import styles from './live-route.module.css'

type LiveRouteRecord={id:string;driver_id:string|null;mission_type:string|null;status:string|null;destination_name:string|null;destination_address:string|null;origin_address:string|null;scheduled_at:string|null;route_date:string|null;position:number|null;priority:string|null}
type Person={user_id:string;email:string|null}

function todayValue(){const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60_000).toISOString().slice(0,10)}
function routeType(value:string|null|undefined,t:Record<string,string>){return value==='pickup'?t.pickup:value==='delivery'?t.delivery:value==='transfer'?t.transfer:value==='return'?t.return:t.routes}
function timeLabel(value:string|null|undefined){if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(date)}
function personName(email:string|null|undefined){if(!email)return 'Driver';const name=email.split('@')[0].replace(/[._-]+/g,' ').trim();return name?name.replace(/\b\w/g,char=>char.toUpperCase()):email}

export default function LiveRoute({companyId,branchId,expanded=false}:{companyId:string;branchId?:string|null;expanded?:boolean}){
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
    try{
      const client=getSupabase()
      const [sessionResult,routeResult,peopleResult]=await Promise.all([
        loadActiveDrivingSessions(companyId,branchId),
        client.from('routes').select('id,driver_id,mission_type,status,destination_name,destination_address,origin_address,scheduled_at,route_date,position,priority').eq('company_id',companyId).in('status',['published','pending','active','paused']).order('position'),
        client.from('company_users').select('user_id,users(email)').eq('company_id',companyId),
      ])
      if(sessionResult.error)throw sessionResult.error
      if(routeResult.error)throw routeResult.error
      if(peopleResult.error)throw peopleResult.error
      const routeRows=(routeResult.data||[]) as LiveRouteRecord[]
      const activeDriverIds=new Set(routeRows.filter(route=>route.status==='active'&&route.driver_id).map(route=>route.driver_id as string))
      const visibleSessions=sessionResult.data.filter(session=>activeDriverIds.has(session.driver_id))
      setSessions(visibleSessions)
      setRoutes(routeRows)
      setPeople((peopleResult.data||[]).map((row:{user_id:string;users:{email?:string|null}|{email?:string|null}[]|null})=>({user_id:row.user_id,email:Array.isArray(row.users)?row.users[0]?.email||null:row.users?.email||null})))
      setSelectedDriver(current=>current&&visibleSessions.some(item=>item.driver_id===current)?current:visibleSessions[0]?.driver_id||null)
      setError('')
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to load live route.')}
    finally{setLoading(false)}
  },[branchId,companyId])

  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    if(!companyId)return
    const client=getSupabase();let disposed=false
    const refresh=()=>{if(!disposed)void load()}
    const channel=client.channel(`live-route-${companyId}`).on('postgres_changes',{event:'*',schema:'public',table:'driving_sessions',filter:`company_id=eq.${companyId}`},refresh).on('postgres_changes',{event:'*',schema:'public',table:'routes',filter:`company_id=eq.${companyId}`},refresh).subscribe()
    const timer=window.setInterval(refresh,30_000)
    return()=>{disposed=true;window.clearInterval(timer);void client.removeChannel(channel)}
  },[companyId,load])

  const selected=sessions.find(item=>item.driver_id===selectedDriver)||sessions[0]
  const selectedRoute=selected?routes.filter(item=>item.driver_id===selected.driver_id).sort((a,b)=>{const rank=(value:string|null)=>value==='active'?0:value==='paused'?1:value==='published'?2:3;return rank(a.status)-rank(b.status)||Number(a.position||0)-Number(b.position||0)}).find(item=>['active','published','pending','paused'].includes(item.status||'')):undefined
  const hasLocation=selected?.last_lat!=null&&selected?.last_lng!=null
  const destination=selectedRoute?.destination_address||selectedRoute?.destination_name||''
  // Maps opens only on explicit action. Location data remains RouteHub-owned.
  const locationUrl=hasLocation?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected?.last_lat},${selected?.last_lng}`)}`:destination?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`:''
  const coordinateLabel=hasLocation?`${Number(selected?.last_lat).toFixed(5)}, ${Number(selected?.last_lng).toFixed(5)}`:''
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
        <div className={styles.mapCard}>
          <div className={styles.locationPanel}>
            <span className={styles.mapLabel}><Navigation size={14}/>{t.live}</span>
            <div className={styles.locationHero}><span className={styles.locationMarker}><Navigation size={22}/></span><div className={styles.liveSummary}><strong>{labels.get(selected?.driver_id||'')||t.driver}</strong><span>{routeType(selectedRoute?.mission_type,t)} <ArrowRight size={12}/> {selectedRoute?.destination_name||selectedRoute?.destination_address||t.currentDestination}</span></div></div>
            <div className={styles.locationFacts}><span><MapPin size={14}/>{hasLocation?coordinateLabel:t.locationUnavailable}</span><span>{formatLocationAge(selected?.last_updated_at,Date.now(),{unavailable:t.locationUnavailable,justNow:t.updatedJustNow,minute:`${t.lastUpdated} 1 min ago`,minutes:`${t.lastUpdated} {n} min ago`,hours:`${t.lastUpdated} {n} hr ago`})}</span></div>
          </div>
          <div className={styles.mapFooter}><span className={styles.lastUpdate}>{selected?.last_accuracy!=null?`±${Math.round(selected.last_accuracy)} m`:t.locationUnavailable}</span>{locationUrl?<a className={styles.openMap} href={locationUrl} target="_blank" rel="noreferrer">{t.mapOpen}<ExternalLink size={13}/></a>:<span className={styles.openMap} aria-disabled="true">{t.mapOpen}<ExternalLink size={13}/></span>}</div>
        </div>
        {selectedRoute&&<div className={styles.routeOverview} aria-label={t.currentRoute}><div className={styles.routeOverviewHeader}><Navigation size={16}/><strong>{t.currentRoute}</strong><span>{routeType(selectedRoute.mission_type,t)}</span></div><div className={styles.routeLeg}><i className={styles.originDot}/><div><small>{t.origin}</small><strong>{selectedRoute.origin_address||t.notRecorded}</strong></div></div><div className={styles.routeLine}/><div className={styles.routeLeg}><i className={styles.destinationDot}/><div><small>{t.currentDestination}</small><strong>{selectedRoute.destination_name||selectedRoute.destination_address||t.destination}</strong>{selectedRoute.destination_address&&selectedRoute.destination_name&&<span>{selectedRoute.destination_address}</span>}</div></div></div>}
        {hasLocation&&selected&&<div className={styles.locationReadout} role="status"><span className={styles.locationDot}/><strong>{labels.get(selected.driver_id)||t.driver}</strong><span>{t.locationSharing}{selected.last_accuracy!=null?` · ±${Math.round(selected.last_accuracy)} m`:''}</span></div>}
      </>}
    </section>
    <section className={styles.today} aria-labelledby="today-routes-title"><div className={styles.sectionHeader}><h2 id="today-routes-title">{t.today}</h2></div>{visibleToday.length===0?<div className={styles.empty}><RouteIcon size={20}/><div><strong>{t.noRoutesToday}</strong><span>{t.createRouteWhenReady}</span></div></div>:<div className={styles.todayList}>{visibleToday.map(route=><div className={styles.todayRow} data-status={route.status||'pending'} key={route.id}><span className={styles.todayIcon}>{route.status==='completed'?'✓':route.status==='active'?'●':'○'}</span><div className={styles.todayText}><strong>{routeType(route.mission_type,t)} · {route.destination_name||route.destination_address||t.destination}</strong><span>{route.status||t.pending}{route.priority==='urgent'?' · '+t.urgent:''}</span></div><span className={styles.todayTime}>{timeLabel(route.scheduled_at)}</span></div>)}</div>}{todayRoutes.length>visibleToday.length&&<Link className={styles.viewAll} href="/routes/manage">{t.viewAll}<ArrowRight size={14}/></Link>}</section>
  </>
}
