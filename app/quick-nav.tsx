'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {Home,Route,BarChart3,Settings,ShieldCheck,Truck,Users,ClipboardList,Briefcase,WalletCards} from 'lucide-react'
import {getAccessProfile,AccessProfile} from '../lib/access'

export default function QuickNav(){
  const[access,setAccess]=useState<AccessProfile|null>(null)
  useEffect(()=>{getAccessProfile().then(setAccess).catch(()=>setAccess(null))},[])
  if(access?.canDrive&&!access?.canManageRoutes&&!access?.canViewAdmin){return <nav className="quick-nav driver-nav" aria-label="Navegacion del Driver"><Link href="/driver" title="Inicio"><Truck size={18}/><span>Inicio</span></Link><Link href="/reports" title="Historial"><ClipboardList size={18}/><span>Historial</span></Link><Link href="/driver/settings" title="Settings"><Settings size={18}/><span>Settings</span></Link></nav>}
  const homeHref=access?.isCeo?'/admin':access?.role==='counter_sales'?'/counter':access?.canManageRoutes?'/manager':'/'
  const items=[
    {href:homeHref,label:'Inicio',icon:Home,show:true},
    {href:'/counter',label:'Counter',icon:WalletCards,show:access?.role==='counter_sales'},
    {href:'/contacts',label:'Contactos',icon:Users,show:!!access?.canCreateRequests},
    {href:'/routes',label:'Rutas',icon:Route,show:!!access?.canManageRoutes},
    {href:'/manager',label:'Manager',icon:Briefcase,show:!!access?.isCeo},
    {href:'/reports',label:'Reportes',icon:BarChart3,show:!!access?.canViewReports},
    {href:'/requests?view=requests',label:'Solicitudes',icon:ClipboardList,show:!!access?.canCreateRequests},
    {href:'/driver',label:'Ruta',icon:Truck,show:!!access?.canDrive},
    {href:'/admin',label:'Admin',icon:ShieldCheck,show:!!access?.canViewAdmin},
    {href:'/settings/contact',label:'Settings',icon:Settings,show:true}
  ]
  const visible=items.filter(i=>i.show||access?.isCeo)
  const navItems=access?.isCeo||access?.canManageRoutes?visible:visible.slice(0,5)
  return <nav className="quick-nav" aria-label="Navegacion principal">{navItems.map(({href,label,icon:Icon})=><Link href={href} title={label} key={href}><Icon size={18}/><span>{label}</span></Link>)}</nav>
}
