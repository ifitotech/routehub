'use client'

import {useEffect,useState} from 'react'
import {AlertTriangle,Camera,CheckCircle2,ChevronRight,Clock3,Flag,MapPin,Navigation,Pause,Play,Route,ShieldCheck,Upload,X} from 'lucide-react'
import {completeStop,getDriverMissions,getMembership} from '../../lib/data'
import {getCurrentLocation} from '../../lib/location'
import {uploadEvidence} from '../../lib/storage'

type ProofMethod='gps'|'photo_override'|'signature'

const issueReasons=[
 {value:'customer_unavailable',label:'Cliente no disponible'},
 {value:'address_problem',label:'Dirección incorrecta o inaccesible'},
 {value:'delivery_refused',label:'Entrega rechazada'},
 {value:'damaged_package',label:'Paquete dañado'},
 {value:'other',label:'Otro problema'}
]

export default function DriverPage(){
 const[missions,setMissions]=useState<any[]>([])
 const[arrived,setArrived]=useState(false)
 const[proofMethod,setProofMethod]=useState<ProofMethod>('gps')
 const[proofFile,setProofFile]=useState<File|null>(null)
 const[issueOpen,setIssueOpen]=useState(false)
 const[issueReason,setIssueReason]=useState(issueReasons[0].value)
 const[issuePhoto,setIssuePhoto]=useState<File|null>(null)
 const[message,setMessage]=useState('')
 const[busy,setBusy]=useState(false)

 const load=async()=>{
  try{
   const result=await getDriverMissions()
   if(result.error)throw result.error
   setMissions(result.data||[])
  }catch{
   setMessage('No pudimos cargar tus rutas. Inténtalo de nuevo en unos segundos.')
  }
 }

 useEffect(()=>{load();const id=setInterval(load,30000);return()=>clearInterval(id)},[])

 const current=missions.find(route=>route.status==='active')||missions.find(route=>route.status==='paused')||missions.find(route=>route.status==='published')
 const stops=[...(current?.route_stops||[])].sort((a:any,b:any)=>(a.position||0)-(b.position||0))
 const stop=stops.find((item:any)=>['pending','active','paused'].includes(item.status))
 const completedStops=stops.filter((item:any)=>item.status==='completed').length
 const hasReportedIssue=stops.some((item:any)=>item.status==='issue')
 const totalStops=stops.length
 const stopPosition=stop?stops.findIndex(item=>item.id===stop.id)+1:totalStops
 const progress=totalStops?Math.round((completedStops/totalStops)*100):0
 const next=missions.find(route=>route.id!==current?.id)
 const address=stop?.contacts?.address||stop?.destination_address||stop?.notes
 const mapsUrl=address?`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`:'https://www.google.com/maps'
 const isStarted=current?.status==='active'||current?.status==='paused'
 const isPaused=current?.status==='paused'
 const schedule=current?.scheduled_at?new Date(current.scheduled_at).toLocaleTimeString('es',{hour:'numeric',minute:'2-digit'}):null

 const changeRouteStatus=async(status:string)=>{
  if(!current||busy)return
  setBusy(true)
  try{
   const{client}=await getMembership()
   const{error}=await client.from('routes').update({status,updated_version:Date.now()}).eq('id',current.id)
   if(error)throw error
   setMessage(status==='paused'?'Ruta pausada. El despacho verá que necesitas apoyo.':status==='active'?'Ruta en curso.':'Estado de la ruta actualizado.')
   await load()
  }catch(error){
   setMessage(error instanceof Error?error.message:'No se pudo actualizar la ruta.')
  }finally{
   setBusy(false)
  }
 }

 const finish=async(status:'completed'|'issue')=>{
  if(!stop||busy)return
  setBusy(true)
  try{
   const isIssue=status==='issue'
   const evidenceFile=isIssue?issuePhoto:proofFile
   let method:ProofMethod=isIssue?(issuePhoto?'photo_override':'gps'):proofMethod
   let loc:any
   if(method==='gps')loc=await getCurrentLocation()
   if(!isIssue&&method!=='gps'&&!evidenceFile)throw new Error(method==='signature'?'Agrega la imagen de la firma antes de completar.':'Agrega una foto antes de completar.')
   const evidenceUrl=evidenceFile?await uploadEvidence(evidenceFile,`stops/${stop.id}/${Date.now()}-${evidenceFile.name}`):undefined
   const result=await completeStop(stop.id,{
    status,
    completion_method:method,
    completion_lat:loc?.lat,
    completion_lng:loc?.lng,
    completion_photo_url:isIssue?undefined:evidenceUrl,
    issue_reason:isIssue?issueReason:undefined,
    issue_photo_url:isIssue?evidenceUrl:undefined
   })
   if(result.error)throw result.error
   if(current?.id){
    const{client}=await getMembership()
    if(isIssue){
     const{error}=await client.from('routes').update({status:'paused',updated_version:Date.now()}).eq('id',current.id)
     if(error)throw error
    }else{
     const remaining=stops.filter((item:any)=>item.id!==stop.id&&!['completed','issue'].includes(item.status))
     if(!remaining.length){
      const{error}=await client.from('routes').update({status:'completed',updated_version:Date.now()}).eq('id',current.id)
      if(error)throw error
     }
    }
   }
   setMessage(isIssue?'Incidencia enviada al despacho. La ruta quedó visible para revisión.':'Entrega registrada correctamente.')
   setProofFile(null)
   setIssuePhoto(null)
   setArrived(false)
   setIssueOpen(false)
   await load()
  }catch(error){
   setMessage(error instanceof Error?error.message:'No se pudo guardar la entrega.')
  }finally{
   setBusy(false)
  }
 }

 const startRoute=async()=>{
  window.open(mapsUrl,'_blank','noopener,noreferrer')
  await changeRouteStatus('active')
 }

 return <main className="shell driver-simple driver-mobile">
  <header className="driver-mobile-header">
   <div><div className="driver-wordmark"><span><Route size={19}/></span>RouteHub</div><h1>Mi ruta</h1></div>
   <span className={`driver-live ${isPaused?'paused':''}`}><i/>{isPaused?'Pausada':'En vivo'}</span>
  </header>

  {current?.priority==='urgent'&&<div className="driver-urgent"><AlertTriangle size={17}/><span><strong>Ruta prioritaria</strong> Esta entrega necesita atención.</span></div>}

  {current?<>
   <section className="driver-progress-card" aria-label="Progreso de ruta">
    <div><span>Ruta de hoy</span><strong>Parada {Math.max(stopPosition,1)} de {Math.max(totalStops,1)}</strong></div>
    <span>{progress}% completada</span>
    <div className="driver-progress-track"><i style={{width:`${progress}%`}}/></div>
   </section>

   {stop?<section className="driver-stop-card">
    <div className="driver-stop-card-head"><span className="driver-stop-icon"><MapPin size={22}/></span><div><span className="driver-card-kicker">Próxima parada</span><strong>{stop.contacts?.company_name||current.destination_name||'Destino de la ruta'}</strong></div><span className="driver-stop-count">{stopPosition} de {totalStops}</span></div>
    <p className="driver-stop-address">{address||'Dirección pendiente'}</p>
    <div className="driver-stop-meta">
     {schedule&&<span><Clock3 size={15}/>Programada: {schedule}</span>}
     {current.order_number&&<span>PO: {current.order_number}</span>}
    </div>
    {!isStarted?<button className="primary driver-main-action" disabled={busy} onClick={startRoute}><Play size={19}/>Iniciar ruta</button>:<a className="primary driver-main-action" href={mapsUrl} target="_blank" rel="noreferrer"><Navigation size={19}/>Navegar a la parada</a>}
   </section>:<section className="driver-stop-card driver-empty-route"><span className="driver-stop-icon">{hasReportedIssue?<AlertTriangle size={22}/>:<CheckCircle2 size={22}/>}</span><h2>{hasReportedIssue?'Incidencia enviada':'Ruta completada'}</h2><p>{hasReportedIssue?'Despacho revisará el problema antes de continuar esta ruta.':'Ya no tienes paradas pendientes en esta ruta.'}</p></section>}

   <section className="driver-route-summary">
    <div><span>Entregas hoy</span><strong>{totalStops}</strong></div>
    <div><span>Completadas</span><strong>{completedStops}</strong></div>
    <div><span>Estado</span><strong className={isPaused?'warning':'good'}>{isPaused?'En pausa':'En ruta'}</strong></div>
   </section>

   {isStarted&&stop&&<section className="driver-delivery-flow">
    {!arrived?<>
     <button className="driver-arrival-action" disabled={busy} onClick={()=>{setArrived(true);setIssueOpen(false)}}><CheckCircle2 size={20}/><span><strong>Ya llegué</strong><small>Activa la prueba de entrega.</small></span><ChevronRight size={18}/></button>
     <button className="driver-pause-action" disabled={busy} onClick={()=>changeRouteStatus(isPaused?'active':'paused')}><Pause size={17}/>{isPaused?'Reanudar ruta':'Pausar ruta'}</button>
    </>:<section className="driver-proof-card">
     <div className="driver-proof-head"><div><span className="driver-card-kicker">Prueba de entrega</span><h2>Completa la entrega</h2></div><button aria-label="Cerrar prueba de entrega" onClick={()=>setArrived(false)}><X size={18}/></button></div>
     <p>Elige cómo confirmar esta parada.</p>
     <div className="driver-proof-methods">
      <button className={proofMethod==='gps'?'selected':''} onClick={()=>{setProofMethod('gps');setProofFile(null)}}><MapPin size={18}/><span>GPS</span></button>
      <button className={proofMethod==='photo_override'?'selected':''} onClick={()=>{setProofMethod('photo_override');setProofFile(null)}}><Camera size={18}/><span>Foto</span></button>
      <button className={proofMethod==='signature'?'selected':''} onClick={()=>{setProofMethod('signature');setProofFile(null)}}><ShieldCheck size={18}/><span>Firma</span></button>
     </div>
     {proofMethod==='gps'?<div className="driver-proof-hint"><MapPin size={17}/><span>Usaremos tu ubicación actual como prueba de entrega.</span></div>:<label className="driver-file-input"><Upload size={18}/><span>{proofFile?proofFile.name:proofMethod==='signature'?'Agregar imagen de firma':'Tomar o subir foto'}</span><input type="file" accept="image/*" capture="environment" onChange={event=>setProofFile(event.target.files?.[0]||null)}/></label>}
     <button className="primary driver-complete-action" disabled={busy||(proofMethod!=='gps'&&!proofFile)} onClick={()=>finish('completed')}><CheckCircle2 size={19}/>{busy?'Guardando…':'Completar entrega'}</button>
    </section>}

    <div className="driver-issue-wrap">
     {!issueOpen?<button className="driver-issue-trigger" disabled={busy} onClick={()=>{setIssueOpen(true);setArrived(false)}}><Flag size={16}/>Reportar incidencia</button>:<section className="driver-issue-card"><div><span className="driver-card-kicker">No se pudo entregar</span><h2>Reporta el problema</h2></div><select aria-label="Motivo de la incidencia" value={issueReason} onChange={event=>setIssueReason(event.target.value)}>{issueReasons.map(reason=><option key={reason.value} value={reason.value}>{reason.label}</option>)}</select><label className="driver-file-input issue-file"><Camera size={18}/><span>{issuePhoto?issuePhoto.name:'Agregar foto (opcional)'}</span><input type="file" accept="image/*" capture="environment" onChange={event=>setIssuePhoto(event.target.files?.[0]||null)}/></label><div><button className="assign" onClick={()=>setIssueOpen(false)}>Cancelar</button><button className="danger-action" disabled={busy} onClick={()=>finish('issue')}><AlertTriangle size={16}/>{busy?'Enviando…':'Enviar incidencia'}</button></div></section>}
    </div>
   </section>}
  </>:<section className="driver-no-route"><span className="driver-stop-icon"><Route size={22}/></span><h2>Aún no tienes una ruta activa</h2><p>Cuando despacho te asigne una, aparecerá aquí automáticamente.</p></section>}

  <section className="driver-next-route"><span className="driver-card-kicker">Siguiente ruta</span>{next?<><h2>{next.destination_name||next.destination_address||'Destino pendiente'}</h2><p>{next.destination_address||next.route_stops?.[0]?.notes||'Dirección pendiente'}</p></>:<p>No hay otra ruta programada por ahora.</p>}</section>
  {message&&<p className="action-feedback feedback-info" role="status">{message}</p>}
 </main>
}
