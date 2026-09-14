'use client'

import Image from 'next/image'
import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import {useEffect} from 'react'
import {ChevronDown, MoreHorizontal, Plus, Route as RouteIcon, Truck, Users} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {useLocale, useThemePreference} from '../../lib/use-preferences'
import './manager-theme.css'
import styles from './manager-shell.module.css'

// A branch with no address on file breaks route creation silently
// (nothing to geocode an origin from) - rather than let a manager hit
// that dead end mid-flow, send them straight to Settings to fill it in
// before they can use anything else. Each branch is set up on its own;
// this never looks at another branch's data to fill the gap.
function useBranchSetupGate(pathname: string) {
  const router = useRouter()
  useEffect(() => {
    if (pathname.startsWith('/settings')) return
    let active = true
    void (async () => {
      const client = getSupabase()
      const {data: userData} = await client.auth.getUser()
      if (!userData.user || !active) return
      const {data: membership} = await client.from('company_users').select('branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
      if (!membership?.branch_id || !active) return
      const {data: branchRow} = await client.from('branches').select('address').eq('id', membership.branch_id).maybeSingle()
      if (active && branchRow && !branchRow.address) router.replace('/settings?setup=branch')
    })()
    return () => { active = false }
  }, [pathname, router])
}

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
  const pathname = usePathname()
  useThemePreference()
  useBranchSetupGate(pathname)
  const copy = locale === 'es'
    ? {today: 'Hoy', dashboard: 'Panel', map: 'Mapa', contacts: 'Contactos', truck: 'Camión', reports: 'Reportes', settings: 'Configuración', newRoute: 'Nueva ruta', workspace: 'Espacio de trabajo', role: 'Manager de sucursal'}
    : locale === 'fr'
      ? {today: 'Aujourd’hui', dashboard: 'Tableau de bord', map: 'Carte', contacts: 'Contacts', truck: 'Camion', reports: 'Rapports', settings: 'Paramètres', newRoute: 'Nouvel itinéraire', workspace: 'Espace de travail', role: 'Manager de succursale'}
      : {today: 'Today', dashboard: 'Dashboard', map: 'Map', contacts: 'Contacts', truck: 'Truck', reports: 'Reports', settings: 'Settings', newRoute: 'New route', workspace: 'Workspace', role: 'Branch Manager'}
  const name = displayName?.trim() || t.managerRole
  const initials = name.slice(0, 2).toUpperCase()
  const role = roleLabel || copy.role
  // Today and Routes used to be two separate screens showing overlapping
  // route data; they're merged into one Dashboard (routes-screen.tsx) so
  // there's a single nav entry instead of two.
  const nav = [
    {id: 'routes' as const, href: '/routes', label: copy.dashboard, Icon: RouteIcon},
    {id: 'contacts' as const, href: '/contacts', label: copy.contacts, Icon: Users},
    {id: 'truck' as const, href: '/manager/truck', label: copy.truck, Icon: Truck},
    {id: 'settings' as const, href: '/settings', label: t.more, Icon: MoreHorizontal},
  ]

  return <main className={styles.shell} data-manager-section={active}>
    <aside className={styles.sidebar} aria-label="Manager navigation">
      <div className={styles.sidebarStart}>
        <Link href="/routes" className={styles.brand} aria-label="RouteHub manager dashboard">
          <Image src="/routehub-regular-new.jpg" alt="" width={40} height={40} priority />
          <span>Route<em>Hub</em></span>
        </Link>
        {/* The Routes page has its own Add route / Cancel toggle in its header
            toolbar, so this link would duplicate it there - it only shows up
            when navigating in from somewhere else. */}
        {active !== 'routes' && <Link href="/routes?new=1" className={styles.newRoute}><Plus size={18} />{copy.newRoute}</Link>}
      </div>
      {/* A true center column (grid: 1fr auto 1fr) instead of sitting right
          next to the logo - nav stays centered in the bar regardless of how
          wide the brand/new-route group on the left or the workspace/
          profile group on the right end up being. */}
      <nav className={styles.nav} aria-label="Primary">
        {nav.map(({id, href, label, Icon}) => <Link href={href} key={id} data-active={active === id ? 'true' : 'false'} aria-current={active === id ? 'page' : undefined}><Icon size={20} /><span>{label}</span></Link>)}
      </nav>
      <div className={styles.sidebarEnd}>
        <div className={styles.workspaceMeta}><span>{copy.workspace}</span><strong>{branchName || t.mainBranch}</strong></div>
        <Link href="/settings" className={styles.profile}><span className={styles.avatar}>{initials}</span><span><strong>{name}</strong><small>{role}</small></span><ChevronDown size={16} /></Link>
      </div>
    </aside>
    <section className={styles.content}>{children}</section>
    {active !== 'routes' && <Link href="/routes?new=1" className={styles.mobileNewRoute} aria-label={copy.newRoute}><Plus size={24}/></Link>}
    <nav className={styles.mobileNav} aria-label="Mobile manager navigation">
      {nav.map(({id, href, label, Icon}) => {
        const isActive = active === id || (id === 'routes' && active === 'map')
        return <Link href={href} key={id} data-active={isActive ? 'true' : 'false'} aria-current={isActive ? 'page' : undefined}><Icon size={18}/><span>{label}</span></Link>
      })}
    </nav>
  </main>
}
