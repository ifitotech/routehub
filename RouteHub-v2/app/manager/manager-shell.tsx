'use client'

import Image from 'next/image'
import Link from 'next/link'
import {ChevronDown, ClipboardList, History, Home, MapPin, MoreHorizontal, Plus, Route as RouteIcon, Settings, Truck, Users} from 'lucide-react'
import {useLocale, useThemePreference} from '../../lib/use-preferences'
import styles from './manager-shell.module.css'

type ManagerSection = 'today' | 'routes' | 'map' | 'truck' | 'contacts' | 'history' | 'reports' | 'settings'

type ManagerShellProps = {
  children: React.ReactNode
  active?: ManagerSection
  branchName?: string
  displayName?: string
  roleLabel?: string
}

export default function ManagerShell({children, active = 'today', branchName, displayName, roleLabel}: ManagerShellProps) {
  const {locale, t} = useLocale()
  useThemePreference()
  const copy = locale === 'es'
    ? {today: 'Hoy', map: 'Mapa', contacts: 'Contactos', reports: 'Reportes', settings: 'Configuración', newRoute: 'Nueva ruta', workspace: 'Espacio de trabajo', role: 'Manager de sucursal'}
    : locale === 'fr'
      ? {today: 'Aujourd’hui', map: 'Carte', contacts: 'Contacts', reports: 'Rapports', settings: 'Paramètres', newRoute: 'Nouvel itinéraire', workspace: 'Espace de travail', role: 'Manager de succursale'}
      : {today: 'Today', map: 'Map', contacts: 'Contacts', reports: 'Reports', settings: 'Settings', newRoute: 'New route', workspace: 'Workspace', role: 'Branch Manager'}
  const name = displayName?.trim() || t.managerRole
  const initials = name.slice(0, 2).toUpperCase()
  const role = roleLabel || copy.role
  const nav = [
    {id: 'today' as const, href: '/manager', label: copy.today, Icon: Home},
    {id: 'routes' as const, href: '/routes', label: t.routes, Icon: RouteIcon},
    {id: 'map' as const, href: '/routes/live', label: copy.map, Icon: MapPin},
    {id: 'truck' as const, href: '/manager/truck', label: locale === 'es' ? 'Camión' : locale === 'fr' ? 'Camion' : 'Truck', Icon: Truck},
    {id: 'contacts' as const, href: '/contacts', label: copy.contacts, Icon: Users},
    {id: 'history' as const, href: '/manager/history', label: t.history, Icon: History},
    {id: 'reports' as const, href: '/reports', label: copy.reports, Icon: ClipboardList},
    {id: 'settings' as const, href: '/settings', label: copy.settings, Icon: Settings},
  ]

  return <main className={styles.shell} data-manager-section={active}>
    <aside className={styles.sidebar} aria-label="Manager navigation">
      <Link href="/manager" className={styles.brand} aria-label="RouteHub manager dashboard">
        <Image src="/routehub-regular-new.jpg" alt="" width={40} height={40} priority />
        <span>Route<em>Hub</em></span>
      </Link>
      <Link href="/routes?new=1" className={styles.newRoute}><Plus size={18} />{copy.newRoute}</Link>
      <nav className={styles.nav} aria-label="Primary">
        {nav.map(({id, href, label, Icon}) => <Link href={href} key={id} data-active={active === id ? 'true' : 'false'} aria-current={active === id ? 'page' : undefined}><Icon size={20} /><span>{label}</span></Link>)}
      </nav>
      <div className={styles.workspaceMeta}><span>{copy.workspace}</span><strong>{branchName || t.mainBranch}</strong></div>
      <Link href="/manager/more" className={styles.profile}><span className={styles.avatar}>{initials}</span><span><strong>{name}</strong><small>{role}</small></span><ChevronDown size={16} /></Link>
    </aside>
    <section className={styles.content}>{children}</section>
    <nav className={styles.mobileNav} aria-label="Mobile manager navigation">
      <Link href="/manager" data-active={active === 'today' ? 'true' : 'false'}><Home size={18}/><span>{copy.today}</span></Link>
      <Link href="/routes" data-active={active === 'routes' ? 'true' : 'false'}><RouteIcon size={18}/><span>{t.routes}</span></Link>
      <Link href="/routes?new=1" className={styles.mobileNewRoute} aria-label={copy.newRoute}><Plus size={24}/></Link>
      <Link href="/routes/live" data-active={active === 'map' ? 'true' : 'false'}><MapPin size={18}/><span>{copy.map}</span></Link>
      <Link href="/manager/more" data-active={active === 'settings' ? 'true' : 'false'}><MoreHorizontal size={18}/><span>{t.more}</span></Link>
    </nav>
  </main>
}
