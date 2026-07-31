'use client'
import Link from 'next/link'
import {Home,Route,ClipboardList,BarChart3,Settings} from 'lucide-react'
export default function QuickNav(){return <nav className="quick-nav" aria-label="Accesos rápidos"><Link href="/" title="Dashboard"><Home size={18}/><span>Inicio</span></Link><Link href="/routes" title="Rutas"><Route size={18}/><span>Rutas</span></Link><Link href="/requests" title="Contactos y solicitudes"><ClipboardList size={18}/><span>Operación</span></Link><Link href="/reports" title="Reportes"><BarChart3 size={18}/><span>Reportes</span></Link><Link href="/settings/contact" title="Settings"><Settings size={18}/><span>Settings</span></Link></nav>}
