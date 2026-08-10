'use client'

import Link from 'next/link'
import {useCallback,useEffect,useState} from 'react'
import {AlertTriangle,ArrowDown,ArrowUp,GripVertical,MoreHorizontal,Pause,Play,Plus,Save,Trash2} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import {canMove,reorder,type Mission} from '../../../lib/planner'
import {useLocale} from '../../../lib/use-preferences'
import styles from './manage.module.css'
import fixes from './manage-mobile-fixes.module.css'

type RouteRow=Mission&{driver_id?:string;driverLabel?:string;notes?:string;order_number?:string;scheduled_at?:string;destination_name?:string}

export default function ManageRoutes(){
 const {t,locale}=useLocale();const [routes,setRoutes]=useState<RouteRow[]>([]),[drivers,setDrivers]=useState<{id:string;label:string}[]>([]),[tab,setTab]=useState<'planned'|'history'>('planned'),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[dragged,setDragged]=useState<number|null>(null),[touchDrag,setTouchDrag]=useState<{sourceIndex:number;startY:number}|null>(null),[editing,setEditing]=useState<string|null>(null),[savingId,setSavingId]=useState<string|null>(null)
 const saveLabel=locale==='es'?'Guardar cambios':locale==='fr'?'Enregistrer les modifications':'Save changes'
 const load=useCallback(async()=>{setLoading(true);try{const client=getSupabase();const{data:userData}=await client.auth.getUser();if(!userData.user)throw Error(t.signIn);const{data:membership}=await client.from('company_users').select('company_id').eq('user_id',userData.user.id).limit(1).maybeSingle();if(!membership)throw Error(t.noMembership);const[{data,error},{data:members}]=await Promise.all([client.from('routes').select('id,status,position,origin_address,destination_address,destination_name,priority,mission_type,driver_id,notes,order_number,scheduled_at').eq('company_id',membership.company_id).order('position'),client.from('company_users').select('user_id,role,users(email)').eq('company_id',membership.company_id).in('role',['driver','branch_manager'])]);if(error)throw error;const labels=new Map<string,string>();const sortedMembers=[...(members||[])].sort((a:any,b:any)=>Number(b.role==='driver')-Number(a.role==='driver'));const available=sortedMembers.map((m:any,index:number)=>{const label=m.users?.email||(m.role==='driver'?`${t.driverAccount} ${index+1}`:`${t.managerRole} ${index+1}`);labels.set(m.user_id,label);return{id:m.user_id,label}});setDrivers(available);setRoutes((data||[]).map((r:any)=>({id:r.id,type:r.mission_type||'delivery',status:r.status||'pending',origin:r.origin_address||t.mainBranch,destination:r.destination_address||t.destination,destination_name:r.destination_name,priority:r.priority||'normal',position:r.position||1,driver_id:r.driver_id,driverLabel:labels.get(r.driver_id)||t.notRecorded,notes:r.notes||'',order_number:r.order_number||'',scheduled_at:r.scheduled_at})));setMessage('')}catch(error){setMessage(error instanceof Error?error.message:t.unableLoadRoutes)}finally{setLoading(false)}},[t])
 useEffect(()=>{void load()},[load])
 const planned=routes.map((route,sourceIndex)=>({route,sourceIndex})).filter(({route})=>!['completed','cancelled','issue'].includes(route.status));const history=routes.filter(route=>['completed','cancelled','issue'].includes(route.status));
 const savePatch=async(id:string,patch:Record<string,unknown>,success='Route updated.')=>{setSavingId(id);try{const{error}=await getSupabase().from('routes').update({...patch,updated_version:Date.now()}).eq('id',id);if(error)throw error;setRoutes(rows=>rows.map(row=>row.id===id?{...row,...patch} as RouteRow:row));setMessage(success);return true}catch(error){setMessage(error instanceof Error?error.message:t.unableUpdateRoute);return false}finally{setSavingId(current=>current===id?null:current)}}
 const persistOrder=async(next:Mission[])=>{const merged=routes.map(original=>next.find(item=>item.id===original.id)?{...original,...next.find(item=>item.id===original.id)!}:original);setRoutes(merged);try{const results=await Promise.all(next.filter(item=>canMove(item.status)).map(item=>getSupabase().from('routes').update({position:item.position,origin_address:item.origin}).eq('id',item.id)));const failure=results.find(result=>result.error);if(failure?.error)throw failure.error;setMessage('Route order updated.')}catch{setMessage('Unable to save route order.');await load()}}
 const move=(from:number,to:number)=>{if(from===to)return;const next=reorder(routes,from,to);if(next!==routes)void persistOrder(next)}
 return <main className={`app ${styles.page}`}><header className={styles.header}><div><span className="eyebrow">DISPATCH</span><h1>{t.manageRoutes}</h1><p>{t.keepMoving}</p></div><Link className="primary" href="/routes?priority=urgent"><AlertTriangle size={17}/>{t.addRoute}</Link></header>
 <div className={styles.tabs} role="tablist"><button className={tab==='planned'?styles.active:''} onClick={()=>setTab('planned')} role="tab" aria-selected={tab==='planned'}>{t.pending} <b>{planned.length}</b></button><button className={tab==='history'?styles.active:''} onClick={()=>setTab('history')} role="tab" aria-selected={tab==='history'}>{t.history} <b>{history.length}</b></button></div>
 {message&&<div className={styles.toast} role="status">{message}</div>}{loading?<div className={styles.skeletons}>{[1,2,3].map(i=><div key={i}/>)}</div>:tab==='planned'?<section className={styles.timeline}>{planned.map(({route,sourceIndex},index)=>{
  const movable=canMove(route.status),previous=planned[index-1]?.sourceIndex,next=planned[index+1]?.sourceIndex
  const finishTouchDrag=(clientY:number)=>{if(touchDrag?.sourceIndex!==sourceIndex)return;const delta=clientY-touchDrag.startY;const target=delta<-28?previous:delta>28?next:undefined;if(target!==undefined)move(sourceIndex,target);setTouchDrag(null)}
  return <article key={route.id} className={`${styles.route} ${fixes.card} ${route.priority==='urgent'?styles.routeUrgent:''}`} draggable={movable} onDragStart={()=>setDragged(sourceIndex)} onDragEnd={()=>setDragged(null)} onDragOver={event=>event.preventDefault()} onDrop={()=>{if(dragged!==null)move(dragged,sourceIndex);setDragged(null)}}>
   <GripVertical className={styles.grip} onPointerDown={event=>{if(!movable||event.pointerType!=='touch')return;event.currentTarget.setPointerCapture(event.pointerId);setTouchDrag({sourceIndex,startY:event.clientY})}} onPointerUp={event=>finishTouchDrag(event.clientY)}/>
   <span className={styles.position}>{String(index+1).padStart(2,'0')}</span>
   <div className={`${styles.routeMain} ${fixes.content}`}><div className={styles.meta}><b>{route.type.toUpperCase()}</b><span className={styles[route.status]||''}>{route.status}</span>{route.priority==='urgent'&&<span className={styles.urgent}>URGENT</span>}</div><h2>{route.destination_name||route.destination}</h2><p>{route.origin} to {route.destination}</p><small>{route.driverLabel}{route.scheduled_at?` | ${new Date(route.scheduled_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}{route.order_number?` | PO ${route.order_number}`:''}</small>
    {editing===route.id&&<div className={styles.editor}><label>{t.driverAccount}<select value={route.driver_id||''} onChange={e=>{const driver=drivers.find(d=>d.id===e.target.value);setRoutes(rows=>rows.map(r=>r.id===route.id?{...r,driver_id:e.target.value,driverLabel:driver?.label}:r))}}>{drivers.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><label>PO<input value={route.order_number||''} onChange={e=>setRoutes(rows=>rows.map(r=>r.id===route.id?{...r,order_number:e.target.value}:r))}/></label><label>{t.notes||'Notes'}<textarea value={route.notes||''} onChange={e=>setRoutes(rows=>rows.map(r=>r.id===route.id?{...r,notes:e.target.value}:r))}/></label><button className="primary" disabled={savingId===route.id} onClick={async()=>{const saved=await savePatch(route.id,{driver_id:route.driver_id,order_number:route.order_number,notes:route.notes});if(saved)setEditing(null)}}><Save size={16}/>{savingId===route.id?t.saving:saveLabel}</button></div>}
   </div>
   <div className={`${styles.actions} ${fixes.cardActions}`}><button aria-label="Move up" disabled={previous===undefined||savingId===route.id} onClick={()=>previous!==undefined&&move(sourceIndex,previous)}><ArrowUp/></button><button aria-label="Move down" disabled={next===undefined||savingId===route.id} onClick={()=>next!==undefined&&move(sourceIndex,next)}><ArrowDown/></button>{route.status==='paused'?<button aria-label={t.resume} disabled={savingId===route.id} onClick={()=>void savePatch(route.id,{status:'active'})}><Play/></button>:<button aria-label={t.pause} disabled={savingId===route.id} onClick={()=>void savePatch(route.id,{status:'paused'})}><Pause/></button>}<button aria-label="More actions" disabled={savingId===route.id} onClick={()=>setEditing(editing===route.id?null:route.id)}><MoreHorizontal/></button><button className={styles.cancel} aria-label={t.cancel} disabled={savingId===route.id} onClick={()=>void savePatch(route.id,{status:'cancelled'})}><Trash2/></button></div>
  </article>
 })}{!planned.length&&<div className={styles.empty}><h2>{t.noRoute}</h2><Link className="primary" href="/routes"><Plus/>{t.addRoute}</Link></div>}</section>:<section className={styles.history}>{history.map(route=><article key={route.id}><div><b>{route.destination_name||route.destination}</b><span>{route.origin} to {route.destination}</span></div><span className={styles[route.status]||''}>{route.status}</span></article>)}{!history.length&&<div className={styles.empty}><h2>{t.noHistory}</h2><p>{t.historyHelp}</p></div>}</section>}
 </main>
}











