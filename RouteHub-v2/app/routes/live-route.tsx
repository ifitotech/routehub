'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {ArrowRight, ExternalLink, MapPin, Navigation, Radio, Route as RouteIcon} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {formatLocationAge, loadActiveDrivingSessions, type DrivingSession} from '../../lib/driving-session'
import {locationFreshness} from '../../lib/route-assignment'
import {useLocale} from '../../lib/use-preferences'
import styles from './live-route.module.css'

const InteractiveLiveRouteMap=dynamic(()=>import('../live-route-map'),{ssr:false})

type LiveRouteRecord={id:string;driver_id:string|null;mission_type:string|null;status:string|null;destination_name:string|null;destination_address:string|null;origin_address:string|null;scheduled_at:string|null;route_date:string|null;position:number|null;priority:string|null}
type Person={user_id:string;email:string|null;role:string|null}

function todayValue(){const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60_000).toISOString().slice(0,10)}
function routeType(value:string|null|undefined,t:Record<string,string>){return value==='pickup'?t.pickup:value==='delivery'?t.delivery:value==='transfer'?t.transfer:value==='return'?t.return:t.routes}
function timeLabel(value:string|null|undefined){if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(date)}
function personName(email:string|null|undefined){if(!email)return 'Team member';const name=email.split('@')[0].replace(/[._-]+/g,' ').trim();return name?name.replace(/\b\w/g,char=>char.toUpperCase()):email}
function openStreetMapEmbed(lat:number,lng:number){const delta=.008;const bbox=[lng-delta,lat-delta,lng+delta,lat+delta].map(value=>value.toFixed(6)).join(',');return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat.toFixed(6)},${lng.toFixed(6)}`)}`}
function openStreetMapLink(lat:number,lng:number){return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=15/${lat.toFixed(6)}/${lng.toFixed(6)}`}

export default function LiveRoute({companyId,branchId,expanded=false,showToday=true}:{companyId:string;branchId?:string|null;expanded?:boolean;showToday?:boolean}){
  const {t}=useLocale()
  const [sessions,setSessions]=useState<DrivingSession[]>([])
  const [routes,setRoutes]=useState<LiveRouteRecord[]>([])
  const [people,setPeople]=useState<Person[]>([])
  const [primaryDriverId,setPrimaryDriverId]=useState<string|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [selectedDriver,setSelectedDriver]=useState<string|null>(null)

  const load=useCallback(async()=>{
    if(!companyId)return
    setLoading(true)
    try{
      const client=getSupabase()
      let routeQuery=client.from('routes').select('id,driver_id,mission_type,status,destination_name,destination_address,origin_address,scheduled_at,route_date,position,priority').eq('company_id',companyId).in('status',['published','pending','active','paused']).order('position')
      if(branchId)routeQuery=routeQuery.eq('branch_id',branchId)
      const [sessionResult,routeResult,peopleResult,branchResult]=await Promise.all([
        loadActiveDrivingSessions(companyId,branchId),
        routeQuery,
        client.from('company_users').select('user_id,role,users(email)').eq('company_id',companyId),
        branchId?client.from('branches').select('primary_driver_id').eq('id',branchId).maybeSingle():Promise.resolve({data:null,error:null}),
      ])
      if(sessionResult.error)throw sessionResult.error
      if(routeResult.error)throw routeResult.error
      if(peopleResult.error)throw peopleResult.error
      if(branchResult.error)throw branchResult.error
      const primaryId=String(branchResult.data?.primary_driver_id||'')||null
      const visibleSessions=[...sessionResult.data].sort((a,b)=>Number(b.driver_id===primaryId)-Number(a.driver_id===primaryId))
      setPrimaryDriverId(primaryId)
      setSessions(visibleSessions)
      setRoutes((routeResult.data||[]) as LiveRouteRecord[])
      setPeople((peopleResult.data||[]).map((row:{user_id:string;role?:string|null;users:{email?:string|null}|{email?:string|null}[]|null})=>({user_id:row.user_id,role:row.role||null,email:Array.isArray(row.users)?row.users[0]?.email||null:row.users?.email||null})))
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
  const driverRoutes=selected?routes.filter(item=>item.driver_id===selected.driver_id):[]
  const selectedRoutes=driverRoutes.filter(item=>((item.route_date||(item.scheduled_at?item.scheduled_at.slice(0,10):''))===todayValue())).sort((a,b)=>{const rank=(value:string|null)=>value==='active'?0:value==='paused'?1:value==='published'?2:3;return rank(a.status)-rank(b.status)||Number(a.position||0)-Number(b.position||0)})
  const selectedRoute=selected?(selected.route_id?driverRoutes.find(item=>item.id===selected.route_id):selectedRoutes.find(item=>['active','paused'].includes(item.status||''))||driverRoutes.find(item=>['active','paused'].includes(item.status||''))):undefined
  const selectedNext=selectedRoutes.find(item=>['published','pending'].includes(item.status||''))
  const hasLocation=selected?.last_lat!=null&&selected?.last_lng!=null
  const destination=selectedRoute?.destination_address||selectedRoute?.destination_name||selectedNext?.destination_address||selectedNext?.destination_name||''
  const locationUrl=hasLocation?openStreetMapLink(Number(selected?.last_lat),Number(selected?.last_lng)):destination?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`:''
  const mapEmbed=hasLocation?openStreetMapEmbed(Number(selected?.last_lat),Number(selected?.last_lng)):''
  const labels=useMemo(()=>new Map(people.map(person=>[person.user_id,personName(person.email)])),[people])
  const roles=useMemo(()=>new Map(people.map(person=>[person.user_id,person.role])),[people])
  const freshness=locationFreshness(selected?.last_updated_at)
  const freshnessLabel=freshness==='recent'?'Recent location':freshness==='approximate'?'Approximate location · may have moved':freshness==='last_known'?'Last known area':t.locationUnavailable
  const selectedIsPrimary=Boolean(selected&&selected.driver_id===primaryDriverId)
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
          <InteractiveLiveRouteMap originAddress={selectedRoute?.origin_address} destinationAddress={destination} driverLocation={hasLocation?{lat:Number(selected?.last_lat),lng:Number(selected?.last_lng)}:null} driverUpdatedAt={selected?.last_updated_at} title="Ruta en vivo"/>
          {mapEmbed&&<iframe className={styles.openStreetMap} title={`${labels.get(selected?.driver_id||'')||t.driver} ${t.liveRoute}`} src={mapEmbed} loading="lazy" referrerPolicy="no-referrer"/>}
          <div className={styles.locationPanel}>
            <span className={styles.mapLabel}><Navigation size={14}/>{t.live}</span>
            <div className={styles.locationHero}><span className={styles.locationMarker}><Navigation size={22}/></span><div className={styles.liveSummary}><strong>{labels.get(selected?.driver_id||'')||t.driver}</strong><span>{selectedIsPrimary?'Primary Driver':`${roles.get(selected?.driver_id||'')||'Team member'} · Temporary assignment`}</span><span>{selectedRoute?`${routeType(selectedRoute.mission_type,t)} → ${selectedRoute.destination_name||selectedRoute.destination_address||t.currentDestination}`:t.noActiveRoutes}</span>{!selectedRoute&&selectedNext&&<span>{t.nextRoute}: {routeType(selectedNext.mission_type,t)} · {selectedNext.destination_name||selectedNext.destination_address}</span>}</div></div>
            <div className={styles.locationFacts}><span><MapPin size={14}/>{freshnessLabel}</span><span>{formatLocationAge(selected?.last_updated_at,Date.now(),{unavailable:t.locationUnavailable,justNow:t.updatedJustNow,minute:`${t.lastUpdated} 1 min ago`,minutes:`${t.lastUpdated} {n} min ago`,hours:`${t.lastUpdated} {n} hr ago`})}</span></div>
          </div>
          <div className={styles.mapFooter}><span className={styles.lastUpdate}>{selected?.last_accuracy!=null?`±${Math.round(selected.last_accuracy)} m`:t.locationUnavailable}</span>{locationUrl?<a className={styles.openMap} href={locationUrl} target="_blank" rel="noreferrer">{t.mapOpen}<ExternalLink size={13}/></a>:<span className={styles.openMap} aria-disabled="true">{t.mapOpen}<ExternalLink size={13}/></span>}</div>
        </div>
        {selectedRoute&&<div className={styles.routeOverview} aria-label={t.currentRoute}><div className={styles.routeOverviewHeader}><Navigation size={16}/><strong>{t.currentRoute}</strong><span>{routeType(selectedRoute.mission_type,t)}</span></div><div className={styles.routeLeg}><i className={styles.originDot}/><div><small>{t.origin}</small><strong>{selectedRoute.origin_address||t.notRecorded}</strong></div></div><div className={styles.routeLine}/><div className={styles.routeLeg}><i className={styles.destinationDot}/><div><small>{t.currentDestination}</small><strong>{selectedRoute.destination_name||selectedRoute.destination_address||t.destination}</strong>{selectedRoute.destination_address&&selectedRoute.destination_name&&<span>{selectedRoute.destination_address}</span>}</div></div></div>}
        {hasLocation&&selected&&<div className={styles.locationReadout} role="status"><span className={styles.locationDot}/><strong>{labels.get(selected.driver_id)||t.driver}</strong><span>{freshnessLabel}{selected.last_accuracy!=null?` · ±${Math.round(selected.last_accuracy)} m`:''}</span></div>}
      </>}
    </section>
    {showToday && <section className={styles.today} aria-labelledby="today-routes-title"><div className={styles.sectionHeader}><h2 id="today-routes-title">{t.today}</h2></div>{visibleToday.length===0?<div className={styles.empty}><RouteIcon size={20}/><div><strong>{t.noRoutesToday}</strong><span>{t.createRouteWhenReady}</span></div></div>:<div className={styles.todayList}>{visibleToday.map(route=><div className={styles.todayRow} data-status={route.status||'pending'} key={route.id}><span className={styles.todayIcon}>{route.status==='completed'?'✓':route.status==='active'?'●':'○'}</span><div className={styles.todayText}><strong>{routeType(route.mission_type,t)} · {route.destination_name||route.destination_address||t.destination}</strong><span>{route.status||t.pending}{route.priority==='urgent'?' · '+t.urgent:''}</span></div><span className={styles.todayTime}>{timeLabel(route.scheduled_at)}</span></div>)}</div>}{todayRoutes.length>visibleToday.length&&<Link className={styles.viewAll} href="/routes/manage">{t.viewAll}<ArrowRight size={14}/></Link>}</section>}
  </>
}
