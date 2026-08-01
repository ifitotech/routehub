'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {Home,Route,BarChart3,Settings,ShieldCheck,Truck,Users,ClipboardList} from 'lucide-react'
import {getAccessProfile,AccessProfile} from '../lib/access'

export default function QuickNav(){
  const[access,setAccess]=useState<AccessProfile|null>(null)
  useEffect(()=>{getAccessProfile().then(setAccess).catch(()=>setAccess(null))},[])
  const items=[
    {href:'/',label:'Inicio',icon:Home,show:true},
    {href:'/requests?view=contacts',label:'Contactos',icon:Users,show:!!access?.canCreateRequests},
    {href:'/routes',label:'Rutas',icon:Route,show:!!access?.canManageRoutes},
    {href:'/reports',label:'Reportes',icon:BarChart3,show:!!access?.canViewReports},
    {href:'/requests?view=requests',label:'Solicitudes',icon:ClipboardList,show:!!access?.canCreateRequests},
    {href:'/driver',label:'Ruta',icon:Truck,show:!!access?.canDrive},
    {href:'/admin',label:'Admin',icon:ShieldCheck,show:!!access?.canViewAdmin},
    {href:'/settings/contact',label:'Settings',icon:Settings,show:true}
  ]
  const visible=items.filter(i=>i.show||access?.isCeo)
  const navItems=access?.isCeo?visible:visible.slice(0,5)
  return <nav className="quick-nav" aria-label="Navegacion principal">{navItems.map(({href,label,icon:Icon})=><Link href={href} title={label} key={href}><Icon size={18}/><span>{label}</span></Link>)}</nav>
}
