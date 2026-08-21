'use client'

import {useEffect,useState} from 'react'
import dynamic from 'next/dynamic'
import {AlertTriangle,ArrowDown,ArrowUp,MoreHorizontal,RefreshCw} from 'lucide-react'
import {getMembership} from '../../../lib/data'
import {DrivingSession,loadActiveDrivingSessions} from '../../../lib/driving-session'
import {reorderMissions,canReorder} from '../../../lib/route-planner'
import {ConfirmationModal} from '../../ui'

const LiveRouteMap=dynamic(()=>import('../../live-route-map'),{ssr:false})

export default function ManageRoutes(){
 const[routes,setRoutes]=useState<any[]>([])
 const[drivers,setDrivers]=useState<any[]>([])
 const[sessions,setSessions]=useState<DrivingSession[]>([])
 const[filter,setFilter]=useState('all')
 const[msg,setMsg]=useState('')
 const[loading,setLoading]=useState(true)
 const[confirm,setConfirm]=useState<any>(null)

 const load=async()=>{
  setLoading(true)
  try{
   const{client,membership}=await getMembership()
   const[routeResult,driverResult,sessionResult]=await Promise.all([
    client.from('routes').select('*, route_stops(*)').eq('company_id',membership.company_id).order('route_date',{ascending:false}).order('position',{ascending:true}),
    client.from('company_users').select('user_id,role,users(email,name)').eq('company_id',membership.company_id),
    loadActiveDrivingSessions(membership.company_id,membership.branch_id)
   ])
   if(routeResult.error)throw routeResult.error
   if(driverResult.error)throw driverResult.error
   setRoutes(routeResult.data||[])
   setDrivers(driverResult.data||[])
   setSessions(sessionResult.data||[])
  }catch(error){
   setMsg(error instanceof Error?error.message:'No se pudieron cargar las rutas.')
  }finally{
   setLoading(false)
  }
 }

 useEffect(()=>{load();const timer=setInterval(load,30000);return()=>clearInterval(timer)},[])

 const driverLabel=(id:string)=>{
  const driver=drivers.find(item=>item.user_id===id)
  return driver?.users?.name||driver?.users?.email||'Miembro del equipo'
 }

 const update=async(id:string,patch:any,action='route_updated')=>{
  try{
   const{client,user,membership}=await getMembership()
   const{error}=await client.from('routes').update({...patch,updated_version:Date.now()}).eq('id',id)
   if(error)throw error
   await client.from('activity_logs').insert({company_id:membership.company_id,user_id:user.id,action,record_id:id,after_value:patch})
   setRoutes(items=>items.map(route=>route.id===id?{...route,...patch}:route))
   setMsg('Cambio guardado.')
  }catch(error){
   setMsg(error instanceof Error?error.message:'No se pudo actualizar la ruta.')
  }
 }

 const filtered=filter==='all'?routes:routes.filter(route=>route.driver_id===filter)
 const move=async(index:number,delta:number)=>{
  const target=index+delta
  if(target<0||target>=filtered.length||!canReorder(filtered[index]))return
  const ordered=reorderMissions(filtered.map((route,itemIndex)=>({id:route.id,position:itemIndex+1,status:route.status,type:route.route_stops?.[0]?.type||'delivery',destination_address:route.destination_address,destination_name:route.destination_name,origin_name:route.origin_name})),index,target)
  for(const mission of ordered)await update(mission.id,{position:mission.position},'route_reordered')
  await load()
 }

 const liveRoute=filtered.find(route=>route.status==='active'&&route.destination_address)||routes.find(route=>route.status==='active'&&route.destination_address)
 const liveSession=liveRoute?sessions.find(session=>session.driver_id===liveRoute.driver_id):null
 const liveLocation=liveSession?.last_lat!=null&&liveSession?.last_lng!=null?{lat:liveSession.last_lat,lng:liveSession.last_lng}:null

 return <main className="shell dispatch-page">
  <div className="eyebrow">ROUTEHUB · DESPACHO</div>
  <div className="dispatch-title"><div><h1>Rutas por conductor</h1><p className="muted">Organiza la operación y sigue las rutas activas.</p></div><button className="secondary" onClick={load}><RefreshCw size={17}/>Actualizar</button></div>
  <select className="dispatch-filter" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">Todos los conductores</option>{drivers.map(driver=><option value={driver.user_id} key={driver.user_id}>{driverLabel(driver.user_id)} · {String(driver.role||'miembro').replaceAll('_',' ')}</option>)}</select>
  {liveRoute&&<LiveRouteMap originAddress={liveRoute.origin_address} destinationAddress={liveRoute.destination_address} driverLocation={liveLocation} driverUpdatedAt={liveSession?.last_updated_at} title={`Ruta en vivo · ${driverLabel(liveRoute.driver_id)}`}/>}
  {loading&&<div className="loading-skeleton"/>}
  {!loading&&filtered.map((route,index)=><article className={`dispatch-card ${route.priority==='urgent'?'urgent':''}`} key={route.id}>
   <div className="timeline-dot"/>
   <div className="dispatch-content">
    <div className="dispatch-card-head"><span className="status-badge status-info">Ruta {index+1} · {route.status}</span>{route.priority==='urgent'&&<span className="status-badge status-danger"><AlertTriangle size={14}/>URGENTE</span>}<button className="icon-button" aria-label="Más acciones"><MoreHorizontal/></button></div>
    <h2>{route.destination_name||route.destination_address||route.route_date}</h2>
    <p className="muted">{route.origin_name||route.origin_address||'Origen pendiente'} → {route.destination_address||'Destino pendiente'}</p>
    <p className="muted"><b>Conductor:</b> {driverLabel(route.driver_id)} · <b>PO:</b> {route.order_number||'—'} · {route.scheduled_at?new Date(route.scheduled_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'Sin horario'}</p>
    <div className="dispatch-actions">
     <select value={route.driver_id||''} onChange={event=>update(route.id,{driver_id:event.target.value},'route_reassigned')}>{drivers.map(driver=><option key={driver.user_id} value={driver.user_id}>{driverLabel(driver.user_id)} · {String(driver.role||'miembro').replaceAll('_',' ')}</option>)}</select>
     <select value={route.status} onChange={event=>{const next=event.target.value;if(next==='paused'||next==='cancelled')setConfirm({id:route.id,status:next});else update(route.id,{status:next},'route_status_changed')}}><option value="draft">Borrador</option><option value="published">Publicada</option><option value="active">Activa</option><option value="paused">Pausada</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option></select>
     <button className="assign" disabled={!canReorder(route)} onClick={()=>move(index,-1)}><ArrowUp size={15}/>Subir</button>
     <button className="assign" disabled={!canReorder(route)} onClick={()=>move(index,1)}><ArrowDown size={15}/>Bajar</button>
     <button className="assign" onClick={()=>update(route.id,{priority:'urgent'},'route_marked_urgent')}><AlertTriangle size={15}/>Urgente</button>
    </div>
   </div>
  </article>)}
  {!loading&&!filtered.length&&<p className="muted">No hay rutas para este conductor.</p>}
  {msg&&<p className="action-feedback feedback-info" role="status">{msg}</p>}
  <ConfirmationModal open={!!confirm} title={confirm?.status==='paused'?'Pausar ruta':'Cancelar ruta'} description={confirm?.status==='paused'?'El conductor verá que la ruta fue pausada.':'La ruta se cancelará y se conservará su historial.'} confirmLabel={confirm?.status==='paused'?'Pausar':'Cancelar'} onCancel={()=>setConfirm(null)} onConfirm={async()=>{if(confirm){await update(confirm.id,{status:confirm.status},'route_status_changed');setConfirm(null)}}}/>
 </main>
}
