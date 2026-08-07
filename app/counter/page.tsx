'use client'
import Link from 'next/link'
import {Contact,ClipboardList,Plus,ArrowRight} from 'lucide-react'

const actions=[
  {href:'/contacts',title:'Contacts',description:'Create and view customers and suppliers.',icon:Contact},
  {href:'/requests',title:'Requests',description:'Register pickups and deliveries for dispatch.',icon:ClipboardList}
]

export default function CounterPage(){
  return <main className="shell counter-page">
    <div className="eyebrow">ROUTEHUB Â· COUNTER SALES</div>
    <h1>Counter Sales</h1>
    <p className="muted">Crea solicitudes y mantÃ©n tus contactos organizados.</p>
    <div className="counter-primary"><Link className="primary" href="/requests"><Plus size={18}/> Nueva solicitud</Link></div>
    <section className="manager-grid" aria-label="Counter Sales actions">
      {actions.map(({href,title,description,icon:Icon})=><Link className="card manager-link" href={href} key={href}>
        <span className="manager-icon"><Icon size={22}/></span><span><strong>{title}</strong><small>{description}</small></span><ArrowRight className="manager-arrow" size={20}/>
      </Link>)}
    </section>
  </main>
}
