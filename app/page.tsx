'use client'

import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Activity,AlertTriangle,ArrowRight,ClipboardList,Clock3,MapPinned,Navigation,Plus,Radio,Route,Truck,Users} from 'lucide-react'
import {getMembership} from '../lib/data'
import {getAccessProfile,AccessProfile} from '../lib/access'

type Summary={active:number;pending:number;issues:number;drivers:number;recent:any[]}

export default function Home(){
 const router=useRouter()
 const[summary,setSummary]=useState<Summary>({active:0,pending:0,issues:0,drivers:0,recent:[]})
 const[access,setAccess]=useState<AccessProfile|null>(null)
 const[message,setMessage]=useState('')

 useEffect(()=>{
  getAccessProfile().then(setAccess).catch(()=>{})
  ;(async()=>{
   try{
    const{client,membership}=await getMembership()
    const[routes,requests,drivers,issues,activity]=await Promise.all([
     client.from('routes').select('id,status').eq('company_id',membership.company_id),
     client.from('requests').select('id,status').eq('company_id',membership.company_id),
     client.from('company_users').select('user_id').eq('company_id',membership.company_id).eq('role','driver'),
     client.from('route_stops').select('id,status,route_id').eq('status','issue'),
     client.from('activity_logs').select('action,created_at').eq('company_id',membership.company_id).order('created_at',{ascending:false}).limit(5)
    ])
    const ids=new Set((routes.data||[]).map((route:any)=>route.id))
    setSummary({
     active:(routes.data||[]).filter((route:any)=>route.status==='active').length,
     pending:(requests.data||[]).filter((request:any)=>['pending','open'].includes(request.status)).length,
     issues:(issues.data||[]).filter((stop:any)=>ids.has(stop.route_id)).length,
     drivers:(drivers.data||[]).length,
     recent:activity.data||[]
    })
   }catch{
    setMessage('Inicia sesión para cargar el resumen operativo.')
   }
  })()
 },[])

 const roleLabel=access?.isCeo?'CEO / Admin':access?.role==='branch_manager'?'Branch Manager':access?.role==='operations_manager'?'Operations Manager':access?.role==='sales_representative'?'Sales Representative':access?.role==='driver'?'Driver':'Counter Sales'
 const canManageRoutes=Boolean(access?.canManageRoutes||access?.isCeo)
 const canCreateRequests=Boolean(access?.canCreateRequests||access?.isCeo)
 const canViewReports=Boolean(access?.canViewReports||access?.isCeo)
 const canViewAdmin=Boolean(access?.canViewAdmin||access?.isCeo)
 const cards=[
  ...(canManageRoutes?[{label:'Rutas activas',value:summary.active,icon:<Truck size={20}/>,tone:'blue',href:'/routes/manage'}]:[]),
  ...(canCreateRequests?[{label:'Solicitudes pendientes',value:summary.pending,icon:<ClipboardList size={20}/>,tone:'orange',href:'/routes'}]:[]),
  ...(canViewReports?[{label:'Incidencias abiertas',value:summary.issues,icon:<AlertTriangle size={20}/>,tone:'red',href:'/reports'}]:[]),
  ...(canViewAdmin?[{label:'Conductores disponibles',value:summary.drivers,icon:<Users size={20}/>,tone:'green',href:'/admin'}]:[])
 ]

 return <main className="shell dashboard dashboard-v2">
  <header className="dashboard-hero">
   <div className="dashboard-hero-glow" aria-hidden="true"/>
   <div className="dashboard-hero-top">
    <div className="dashboard-identity"><span className="dashboard-logo"><Route size={20}/></span><span>RouteHub <small>Control Center</small></span></div>
    <div className="dashboard-user"><span className="dashboard-presence"><i/>En línea</span><div className="avatar">{roleLabel.slice(0,2).toUpperCase()}</div></div>
   </div>
   <div className="dashboard-hero-content">
    <div>
     <span className="dashboard-eyebrow"><Radio size={14}/> Operación en tiempo real</span>
     <h1>Tu operación, siempre bajo control.</h1>
     <p>Una vista clara para decidir rápido, seguir cada ruta y mantener a tu equipo avanzando.</p>
     <div className="dashboard-hero-actions">
      {canManageRoutes&&<button className="primary hero-primary" onClick={()=>router.push('/routes?create=1')}><Plus size={18}/>Crear ruta</button>}
      {canManageRoutes&&<button className="hero-secondary" onClick={()=>router.push('/routes/manage')}><Navigation size={18}/>Ver despacho</button>}
      {access?.canDrive&&<button className="primary hero-primary" onClick={()=>router.push('/driver')}><Truck size={18}/>Mi ruta</button>}
     </div>
    </div>
    <div className="dashboard-hero-status">
     <span className="dashboard-status-icon"><Activity size={21}/></span>
     <div><small>Tu espacio actual</small><strong>{roleLabel}</strong><span>{summary.active?`${summary.active} ruta${summary.active===1?'':'s'} activa${summary.active===1?'':'s'}`:'Listo para iniciar'}</span></div>
    </div>
   </div>
  </header>

  {cards.length>0&&<section className="stats dashboard-stats dashboard-metrics" aria-label="Resumen operativo">
   {cards.map(card=><button className={`stat-card stat-card-${card.tone}`} key={card.label} onClick={()=>router.push(card.href)}>
    <span className={`stat-icon ${card.tone}`}>{card.icon}</span>
    <small>{card.label}</small>
    <strong>{card.value}</strong>
    <span className="stat-link">Abrir sección <ArrowRight size={14}/></span>
   </button>)}
  </section>}

  <section className="dashboard-command-grid">
   <article className="dashboard-route-vision">
    <div className="dashboard-panel-head">
     <div><span className="panel-kicker"><MapPinned size={15}/> Panorama operativo</span><h2>Rutas en movimiento</h2></div>
     <button className="compact-action" onClick={()=>router.push('/routes/manage')}>Gestionar <ArrowRight size={15}/></button>
    </div>
    <div className="route-vision-canvas" aria-label="Representación visual de la actividad de las rutas">
     <span className="route-trail trail-one"/><span className="route-trail trail-two"/><span className="route-trail trail-three"/>
     <span className="route-node node-start"><i/></span><span className="route-node node-middle"><i/></span><span className="route-node node-end"><i/></span>
     <span className="route-vehicle"><Truck size={16}/></span>
     <span className="route-live-label"><i/> Seguimiento activo</span>
    </div>
    <div className="route-vision-footer">
     <div><span>Estado de hoy</span><strong>{summary.active?`${summary.active} ruta${summary.active===1?'':'s'} en marcha`:'Sin rutas activas'}</strong></div>
     <div><span>Atención requerida</span><strong className={summary.issues?'attention':'clear'}>{summary.issues?`${summary.issues} incidencia${summary.issues===1?'':'s'}`:'Todo en orden'}</strong></div>
    </div>
   </article>

   <article className={`dashboard-priority ${summary.issues?'has-issues':''}`}>
    <div className="priority-icon">{summary.issues?<AlertTriangle size={22}/>:<Activity size={22}/>}</div>
    <span className="panel-kicker">{summary.issues?'Requiere atención':'Operación estable'}</span>
    <h2>{summary.issues?'Hay elementos que revisar.':'Todo va por buen camino.'}</h2>
    <p>{summary.issues?'Revisa las incidencias abiertas para mantener las entregas a tiempo.':'No hay incidencias abiertas en las rutas activas.'}</p>
    <button className="priority-link" onClick={()=>router.push(summary.issues?'/reports':'/routes/manage')}>{summary.issues?'Revisar incidencias':'Ver despacho'} <ArrowRight size={16}/></button>
   </article>
  </section>

  <section className="dashboard-grid dashboard-lower-grid">
   <article className="card dashboard-panel dashboard-actions-panel">
    <div className="section-head"><div><span className="panel-kicker">Accesos directos</span><h2>Lo que necesitas ahora</h2></div></div>
    <div className="quick-actions">
     {canManageRoutes&&<><button className="primary" onClick={()=>router.push('/routes?create=1')}><Plus size={18}/>Crear ruta</button><button className="assign" onClick={()=>router.push('/routes/manage')}><Activity size={18}/>Gestionar despacho</button></>}
     {canViewReports&&<button className="assign" onClick={()=>router.push('/reports')}><ClipboardList size={18}/>Abrir reportes</button>}
     {access?.canDrive&&<button className="assign" onClick={()=>router.push('/driver')}><Truck size={18}/>Mi ruta</button>}
    </div>
   </article>

   <article className="card dashboard-panel dashboard-activity-panel">
    <div className="section-head"><div><span className="panel-kicker">Actividad</span><h2>Últimos movimientos</h2></div><Clock3 size={19}/></div>
    {summary.recent.length?summary.recent.map((activity:any,index:number)=><div className="activity-row" key={`${activity.created_at}-${index}`}><span className="activity-dot"/><div><b>{String(activity.action||'Actualización').replaceAll('_',' ')}</b><small>{activity.created_at?new Date(activity.created_at).toLocaleString():'Ahora'}</small></div></div>):<div className="activity-empty"><Activity size={18}/><span>La actividad de tu equipo aparecerá aquí.</span></div>}
   </article>
  </section>

  <section className="card dashboard-tip"><span className="tip-icon"><Users size={18}/></span><div><strong>Un centro de control hecho para tu equipo</strong><span>Ves únicamente las acciones y la información que corresponden a tu rol.</span></div><button className="link-button" onClick={()=>router.push('/settings/contact')}>Configuración <ArrowRight size={16}/></button></section>
  {message&&<p className="action-feedback feedback-info" role="status">{message}</p>}
  <footer><span>RouteHub</span><span>v0.1</span></footer>
 </main>
}
