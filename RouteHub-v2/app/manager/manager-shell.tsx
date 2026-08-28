'use client'

import Image from 'next/image'
import Link from 'next/link'
import {ChevronDown, ClipboardList, History, Home, MapPin, MoreHorizontal, Plus, Route as RouteIcon, Settings, Users} from 'lucide-react'
import {useLocale} from '../../lib/use-preferences'
import dashboardStyles from './manager-dashboard.module.css'
import styles from './manager-shell.module.css'

type ManagerSection = 'today' | 'routes' | 'map' | 'contacts' | 'history' | 'reports' | 'settings'

type ManagerShellProps = {
  children: React.ReactNode
  active?: ManagerSection
  branchName?: string
  displayName?: string
  roleLabel?: string
}

export default function ManagerShell({children, active = 'today', branchName, displayName, roleLabel}: ManagerShellProps) {
  const {locale, t} = useLocale()
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
    {id: 'contacts' as const, href: '/contacts', label: copy.contacts, Icon: Users},
    {id: 'history' as const, href: '/manager/history', label: t.history, Icon: History},
    {id: 'reports' as const, href: '/reports', label: copy.reports, Icon: ClipboardList},
    {id: 'settings' as const, href: '/settings', label: copy.settings, Icon: Settings},
  ]

  return <main className={`app ${dashboardStyles.dashboard} ${styles.shell}`}>
    <aside className={`${dashboardStyles.desktopSidebar} ${styles.sidebar}`} aria-label="Manager navigation">
      <Link href="/manager" className={`${dashboardStyles.sidebarBrand} ${styles.brand}`} aria-label="RouteHub manager dashboard">
        <Image src="/routehub-regular-new.jpg" alt="" width={40} height={40} priority />
        <span>Route<em>Hub</em></span>
      </Link>
      <Link href="/routes?new=1" className={`${dashboardStyles.newRoute} ${styles.newRoute}`}><Plus size={20} />{copy.newRoute}</Link>
      <nav className={`${dashboardStyles.sidebarNav} ${styles.nav}`} aria-label="Primary">
        {nav.map(({id, href, label, Icon}) => <Link href={href} key={id} data-active={active === id ? 'true' : 'false'} aria-current={active === id ? 'page' : undefined}><Icon size={20} /><span>{label}</span></Link>)}
      </nav>
      <div className={styles.workspaceMeta}><span>{copy.workspace}</span><strong>{branchName || t.mainBranch}</strong></div>
      <Link href="/manager/more" className={`${dashboardStyles.sidebarProfile} ${styles.profile}`}><span className={dashboardStyles.sidebarAvatar}>{initials}</span><span><strong>{name}</strong><small>{role}</small></span><ChevronDown size={16} /></Link>
    </aside>
    <section className={`${dashboardStyles.workspace} ${styles.content}`}>{children}</section>
  </main>
}
