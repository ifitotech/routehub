'use client'
import Link from 'next/link'
import {Contact,ClipboardList,Plus,ArrowRight} from 'lucide-react'

const actions=[
  {href:'/contacts',title:'Contactos',description:'Crear y consultar clientes y proveedores.',icon:Contact},
  {href:'/requests',title:'Solicitudes',description:'Registrar pickups y entregas para despacho.',icon:ClipboardList}
]

export default function CounterPage(){
  return <main className="shell counter-page">
    <div className="eyebrow">ROUTEHUB · COUNTER SALES</div>
    <h1>Counter Sales</h1>
    <p className="muted">Crea solicitudes y mantén tus contactos organizados.</p>
    <div className="counter-primary"><Link className="primary" href="/requests"><Plus size={18}/> Nueva solicitud</Link></div>
    <section className="manager-grid" aria-label="Acciones de Counter Sales">
      {actions.map(({href,title,description,icon:Icon})=><Link className="card manager-link" href={href} key={href}>
        <span className="manager-icon"><Icon size={22}/></span><span><strong>{title}</strong><small>{description}</small></span><ArrowRight className="manager-arrow" size={20}/>
      </Link>)}
    </section>
  </main>
}
