'use client'
import {useEffect,useState} from 'react'
import {ArrowRight,CalendarDays,Edit3,GripVertical} from 'lucide-react'
import {getMembership} from '../../lib/data'

export default function SavedRoutes(){
  const [routes,setRoutes]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  useEffect(()=>{(async()=>{try{const {client,membership}=await getMembership();const {data}=await client.from('routes').select('*').eq('company_id',membership.company_id).order('position',{ascending:true}).order('route_date',{ascending:false});setRoutes(data||[])}finally{setLoading(false)}})()},[])
  if(loading)return <section className="loading-skeleton"><span/><span/><span/></section>
  return <section className="configured-routes"><div className="section-head"><div><h2>Rutas guardadas ({routes.length})</h2><p className="muted">Edita el orden, conductor y estado desde aquí.</p></div><a className="assign" href="/routes/manage">Gestionar</a></div>{routes.length===0?<div className="empty-state"><h3>Aún no hay rutas guardadas</h3><p>Crea tu primera ruta arriba.</p></div>:<div className="saved-route-list">{routes.map((r,i)=><article className="card saved-route-card" key={r.id}><span className="saved-route-position"><GripVertical size={16}/>{r.position??i+1}</span><div className="saved-route-main"><div className="saved-route-head"><span className={`status-badge ${r.status==='completed'?'status-success':r.status==='cancelled'?'status-danger':'status-info'}`}>{r.status||'draft'}</span><span className="muted"><CalendarDays size={14}/> {r.route_date||'Sin fecha'}</span></div><h3>{r.origin_name||r.origin_address||'Origen pendiente'} <ArrowRight size={16}/> {r.destination_name||r.destination_address||'Destino pendiente'}</h3><p className="muted">{r.order_number?`PO: ${r.order_number} · `:''}{r.priority||'normal'}</p></div><a className="assign" href="/routes/manage" aria-label={`Editar ruta ${i+1}`}><Edit3 size={16}/> Editar</a></article>)}</div>}</section>
}
