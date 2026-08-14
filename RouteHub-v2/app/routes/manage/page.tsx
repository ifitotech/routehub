'use client'

import Link from 'next/link'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {AlertTriangle,ArrowDown,ArrowUp,GripVertical,MoreHorizontal,Pause,Play,Plus,RotateCcw,Save,Trash2} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import {canMove,reorder,type Mission} from '../../../lib/planner'
import {groupRouteQueues} from '../../../lib/route-queue'
import {useLocale} from '../../../lib/use-preferences'
import styles from './manage.module.css'
import fixes from './manage-mobile-fixes.module.css'

type RouteRow=Mission&{company_id:string;branch_id:string|null;route_date:string;driver_id:string;driverLabel:string;notes:string;order_number:string;scheduled_at?:string;destination_name?:string}
type Driver={id:string;label:string}
type UndoAction={queueKey:string;routeIds:string[]}
type RetryAction={queueKey:string;routeIds:string[]}

const isHistory=(status:string)=>['completed','cancelled','issue'].includes(status)
const routeLabel=(route:RouteRow)=>route.destination_name||route.destination||'Destination'

export default function ManageRoutes(){
 const {t,locale}=useLocale()
 const [routes,setRoutes]=useState<RouteRow[]>([])
 const [drivers,setDrivers]=useState<Driver[]>([])
 const [tab,setTab]=useState<'planned'|'history'>('planned')
 const [message,setMessage]=useState('')
 const [messageError,setMessageError]=useState(false)
 const [loading,setLoading]=useState(true)
 const [dragged,setDragged]=useState<{queueKey:string;index:number}|null>(null)
 const [touchDrag,setTouchDrag]=useState<{queueKey:string;sourceIndex:number;startY:number}|null>(null)
 const [editing,setEditing]=useState<string|null>(null)
 const [savingId,setSavingId]=useState<string|null>(null)
 const [undo,setUndo]=useState<UndoAction|null>(null)
 const [retry,setRetry]=useState<RetryAction|null>(null)
 const resetTimer=useRef<number>()
 const saveLabel=locale==='es'?'Guardar cambios':locale==='fr'?'Enregistrer les modifications':'Save changes'

 const showMessage=(next:string,error=false)=>{setMessage(next);setMessageError(error);window.clearTimeout(resetTimer.current);resetTimer.current=window.setTimeout(()=>{setMessage('');setRetry(null)},4500)}
 const load=useCallback(async()=>{
  setLoading(true)
  try{
   const client=getSupabase()
   const {data:userData}=await client.auth.getUser()
   if(!userData.user)throw Error(t.signIn)
   const {data:membership}=await client.from('company_users').select('company_id').eq('user_id',userData.user.id).limit(1).maybeSingle()
   if(!membership)throw Error(t.noMembership)
   const [{data,error},{data:members}]=await Promise.all([
    client.from('routes').select('id,company_id,branch_id,route_date,status,position,origin_address,destination_address,destination_name,priority,mission_type,driver_id,notes,order_number,scheduled_at').eq('company_id',membership.company_id).order('route_date').order('driver_id').order('position'),
    client.from('company_users').select('user_id,role,users(email)').eq('company_id',membership.company_id)
   ])
   if(error)throw error
   const labels=new Map<string,string>()
   const available=(members||[]).map((member:any,index:number)=>{
    const label=member.users?.email||`${member.role==='driver'?t.driverAccount:t.teamDriver} ${index+1}`
    labels.set(member.user_id,label)
    return {id:member.user_id,label}
   })
   setDrivers(available)
   setRoutes((data||[]).map((row:any)=>({
    id:row.id,company_id:row.company_id,branch_id:row.branch_id??null,route_date:row.route_date,type:row.mission_type||'delivery',status:row.status||'pending',origin:row.origin_address||t.mainBranch,destination:row.destination_address||t.destination,destination_name:row.destination_name||'',priority:row.priority||'normal',position:Number(row.position||1),driver_id:row.driver_id,driverLabel:labels.get(row.driver_id)||t.notRecorded,notes:row.notes||'',order_number:row.order_number||'',scheduled_at:row.scheduled_at
   })))
   setMessage('')
  }catch(error){showMessage(error instanceof Error?error.message:t.unableLoadRoutes,true)}finally{setLoading(false)}
 },[t])

 useEffect(()=>{void load();return()=>window.clearTimeout(resetTimer.current)},[load])
 useEffect(()=>{
  const client=getSupabase()
  const channel=client.channel('manage-route-order').on('postgres_changes',{event:'*',schema:'public',table:'routes'},()=>void load()).subscribe()
  return()=>{void client.removeChannel(channel)}
 },[load])

 const queues=useMemo(()=>{
  return groupRouteQueues(routes).map(queue=>({
   ...queue,
   label:queue.routes[0]?.driverLabel||t.teamDriver,
   routeDate:queue.routes[0]?.route_date||'',
   items:[...queue.routes].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))
  }))
 },[routes,t.teamDriver])
 const plannedCount=routes.filter(route=>canMove(route.status)).length
 const historyCount=routes.filter(route=>isHistory(route.status)).length

 const queueFor=(queueKey:string)=>groupRouteQueues(routes).find(queue=>queue.key===queueKey)?.routes.filter(route=>canMove(route.status)).sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))||[]
 const applyQueue=(queueKey:string,next:Mission[])=>setRoutes(current=>current.map(route=>{
  if(groupRouteQueues([route])[0]?.key!==queueKey)return route
  const replacement=next.find(item=>item.id===route.id)
  return replacement?{...route,...replacement}:route
 }))
 const saveQueue=async(queueKey:string,routeIds:string[],previousIds?:string[])=>{
  try{
   const {data,error}=await getSupabase().rpc('reorder_route_queue',{p_route_ids:routeIds})
   if(error)throw error
   // The database is the source of truth. Apply its normalized positions and
   // relinked origins immediately instead of waiting for a subscription.
   if(data) setRoutes(current=>current.map(route=>{
    const persisted=(data as {id:string;position:number;origin_address:string}[]).find(item=>item.id===route.id)
    return persisted?{...route,position:persisted.position,origin:persisted.origin_address||route.origin}:route
   }))
   window.dispatchEvent(new Event('routehub:notifications-refresh'))
   setUndo(previousIds?{queueKey,routeIds:previousIds}:null)
   setRetry(null)
   showMessage('Route order updated.')
   return true
  }catch(error){
   if(previousIds){
    const previous=reorderQueueFromIds(queueFor(queueKey),previousIds)
    applyQueue(queueKey,previous)
   }
   await load()
   setRetry({queueKey,routeIds})
   showMessage("Couldn't update route order. Your previous order was restored.",true)
   return false
  }
 }
 const move=(queueKey:string,from:number,to:number)=>{
  const queue=queueFor(queueKey)
  if(from===to||to<0||to>=queue.length)return
  const next=reorder(queue,from,to)
  if(next===queue)return
  const previousIds=queue.map(route=>route.id)
  applyQueue(queueKey,next)
  void saveQueue(queueKey,next.map(route=>route.id),previousIds)
 }
 const undoOrder=()=>{
  if(!undo)return
  const current=queueFor(undo.queueKey)
  const next=reorderQueueFromIds(current,undo.routeIds)
  applyQueue(undo.queueKey,next)
  const currentIds=current.map(route=>route.id)
  setUndo(null)
  void saveQueue(undo.queueKey,undo.routeIds,currentIds)
 }
 const savePatch=async(route:RouteRow)=>{
  setSavingId(route.id)
  try{
   const original=routes.find(item=>item.id===route.id)
   if(!original)throw Error(t.unableUpdateRoute)
   if(original.driver_id!==route.driver_id){
    const result=await getSupabase().rpc('reassign_upcoming_route',{p_route_id:route.id,p_driver_id:route.driver_id})
    if(result.error)throw result.error
   }
   const {error}=await getSupabase().from('routes').update({order_number:route.order_number,notes:route.notes,updated_version:Date.now()}).eq('id',route.id)
   if(error)throw error
   setEditing(null);showMessage('Route updated.');await load()
  }catch(error){showMessage(error instanceof Error?error.message:t.unableUpdateRoute,true)}finally{setSavingId(null)}
 }
 const changeStatus=async(route:RouteRow,status:string)=>{
  setSavingId(route.id)
  try{const {error}=await getSupabase().from('routes').update({status,updated_version:Date.now()}).eq('id',route.id);if(error)throw error;showMessage('Route updated.');await load()}catch(error){showMessage(error instanceof Error?error.message:t.unableUpdateRoute,true)}finally{setSavingId(null)}
 }

 return <main className={`app ${styles.page}`}>
  <header className={styles.header}><div><span className="eyebrow">DISPATCH</span><h1>{t.manageRoutes}</h1><p>Drag an upcoming route where you want it. RouteHub handles the rest.</p></div><Link className="primary" href="/routes?priority=urgent"><AlertTriangle size={17}/>{t.addRoute}</Link></header>
  <div className={styles.tabs} role="tablist"><button className={tab==='planned'?styles.active:''} onClick={()=>setTab('planned')} role="tab" aria-selected={tab==='planned'}>{t.pending}<b>{plannedCount}</b></button><button className={tab==='history'?styles.active:''} onClick={()=>setTab('history')} role="tab" aria-selected={tab==='history'}>{t.history}<b>{historyCount}</b></button></div>
  {message&&<div className={`${styles.toast} ${messageError?styles.toastError:''}`} role="status">{message}{undo&&<button onClick={undoOrder}><RotateCcw size={15}/>Undo</button>}{retry&&<button onClick={()=>void saveQueue(retry.queueKey,retry.routeIds)}><RotateCcw size={15}/>Retry</button>}</div>}
  {loading?<div className={styles.skeletons} aria-label="Loading routes" aria-busy="true">{[1,2,3].map(i=><div className={styles.skeletonCard} key={i}/>)}</div>:tab==='planned'?<section className={styles.timeline}>
   {queues.map(group=>{
    const active=group.items.filter(route=>route.status==='active')
    const queue=group.items.filter(route=>canMove(route.status))
    return <section className={styles.driverQueue} key={group.key}><header><strong>{group.label}</strong><span>{group.routeDate} · {queue.length} upcoming</span></header>
     {active.map(route=><article key={route.id} className={`${styles.route} ${styles.lockedRoute} ${fixes.card}`}><span className={styles.position}>{String(route.position).padStart(2,'0')}</span><div className={`${styles.routeMain} ${fixes.content}`}><div className={styles.meta}><b>{route.type.toUpperCase()}</b><span className={styles.active}>In progress</span></div><h2>{routeLabel(route)}</h2><p>{route.origin} → {route.destination}</p></div><div className={`${styles.actions} ${fixes.cardActions}`}><button aria-label={t.pause} disabled={savingId===route.id} onClick={()=>void changeStatus(route,'paused')}><Pause/></button></div></article>)}
     {queue.map((route,index)=>{
      const previous=index-1,next=index+1
      const completeTouch=(clientY:number)=>{if(touchDrag?.queueKey!==group.key||touchDrag.sourceIndex!==index)return;const target=Math.max(0,Math.min(queue.length-1,index+Math.round((clientY-touchDrag.startY)/74)));setTouchDrag(null);move(group.key,index,target)}
      return <article key={route.id} className={`${styles.route} ${fixes.card} ${route.priority==='urgent'?styles.routeUrgent:''}`} draggable onDragStart={()=>setDragged({queueKey:group.key,index})} onDragEnd={()=>setDragged(null)} onDragOver={event=>event.preventDefault()} onDrop={()=>{if(dragged?.queueKey===group.key)move(group.key,dragged.index,index);setDragged(null)}}>
       <button className={styles.gripButton} aria-label={`Drag ${routeLabel(route)}`} onPointerDown={event=>{if(event.pointerType!=='touch')return;event.currentTarget.setPointerCapture(event.pointerId);setTouchDrag({queueKey:group.key,sourceIndex:index,startY:event.clientY})}} onPointerUp={event=>completeTouch(event.clientY)}><GripVertical className={styles.grip}/></button>
       <span className={styles.position}>{String(route.position).padStart(2,'0')}</span>
       <div className={`${styles.routeMain} ${fixes.content}`}><div className={styles.meta}><b>{route.type.toUpperCase()}</b><span className={styles[route.status]||''}>{route.status}</span>{route.priority==='urgent'&&<span className={styles.urgent}>URGENT</span>}</div><h2>{routeLabel(route)}</h2><p>{route.origin} → {route.destination}</p><small>{route.scheduled_at?new Date(route.scheduled_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}{route.order_number?` · PO ${route.order_number}`:''}</small>
        {editing===route.id&&<div className={styles.editor}><label>{t.driverAccount}<select value={route.driver_id} onChange={event=>{const driver=drivers.find(item=>item.id===event.target.value);setRoutes(rows=>rows.map(row=>row.id===route.id?{...row,driver_id:event.target.value,driverLabel:driver?.label||row.driverLabel}:row))}}>{drivers.map(driver=><option key={driver.id} value={driver.id}>{driver.label}</option>)}</select></label><label>PO<input value={route.order_number} onChange={event=>setRoutes(rows=>rows.map(row=>row.id===route.id?{...row,order_number:event.target.value}:row))}/></label><label>{t.notes||'Notes'}<textarea value={route.notes} onChange={event=>setRoutes(rows=>rows.map(row=>row.id===route.id?{...row,notes:event.target.value}:row))}/></label><button className="primary" disabled={savingId===route.id} onClick={()=>void savePatch(routes.find(item=>item.id===route.id) || route)}><Save size={16}/>{savingId===route.id?t.saving:saveLabel}</button></div>}
       </div>
       <div className={`${styles.actions} ${fixes.cardActions}`}><button aria-label="Move to top" disabled={previous<0||savingId===route.id} onClick={()=>move(group.key,index,0)}><ArrowUp/></button><button aria-label="Move down" disabled={next>=queue.length||savingId===route.id} onClick={()=>move(group.key,index,next)}><ArrowDown/></button>{route.status==='paused'?<button aria-label={t.resume} disabled={savingId===route.id} onClick={()=>void changeStatus(route,'published')}><Play/></button>:<button aria-label={t.pause} disabled={savingId===route.id} onClick={()=>void changeStatus(route,'paused')}><Pause/></button>}<button aria-label="Edit route" disabled={savingId===route.id} onClick={()=>setEditing(editing===route.id?null:route.id)}><MoreHorizontal/></button><button className={styles.cancel} aria-label={t.cancel} disabled={savingId===route.id} onClick={()=>void changeStatus(route,'cancelled')}><Trash2/></button></div>
      </article>
     })}
    </section>
   })}
   {!plannedCount&&<div className={styles.empty}><h2>{t.noRoute}</h2><Link className="primary" href="/routes"><Plus/>{t.addRoute}</Link></div>}
  </section>:<section className={styles.history}>{routes.filter(route=>isHistory(route.status)).sort((a,b)=>b.position-a.position).map(route=><article key={route.id}><div><b>{routeLabel(route)}</b><span>{route.driverLabel} · {route.origin} → {route.destination}</span></div><span className={styles[route.status]||''}>{route.status}</span></article>)}{!historyCount&&<div className={styles.empty}><h2>{t.noHistory}</h2><p>{t.historyHelp}</p></div>}</section>}
 </main>
}

function reorderQueueFromIds(queue:RouteRow[],ids:string[]):Mission[]{
 const byId=new Map(queue.map(route=>[route.id,route]))
 const ordered=ids.map(id=>byId.get(id)).filter(Boolean) as RouteRow[]
 const remaining=queue.filter(route=>!ids.includes(route.id))
 // Preserve actual persisted positions when rolling back an optimistic update.
 return [...ordered,...remaining]
}
