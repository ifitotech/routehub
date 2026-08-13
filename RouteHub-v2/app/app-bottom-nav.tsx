'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Building2, History, Home, MoreHorizontal, Route as RouteIcon, Settings} from 'lucide-react'
import {useLocale} from '../lib/use-preferences'
import styles from './app-bottom-nav.module.css'

/** Shared bottom navigation for pages that do not render their workspace nav. */
export default function AppBottomNav() {
  const pathname = usePathname()
  const {t} = useLocale()
  const hasLocalNav = pathname === '/manager' || pathname === '/operations' || pathname === '/sales' || pathname === '/counter' || pathname.startsWith('/driver')
  if (pathname === '/login' || pathname === '/auth/callback' || hasLocalNav) return null

  const links = pathname.startsWith('/admin')
    ? [{href: '/admin', label: t.home, Icon: Home}, {href: '/admin/companies', label: t.company, Icon: Building2}, {href: '/settings', label: t.settings, Icon: Settings}]
    : pathname.startsWith('/manager') || pathname === '/routes' || pathname.startsWith('/routes/') || pathname === '/contacts' || pathname === '/requests' || pathname === '/reports' || pathname === '/settings'
      ? [
          {href: '/manager', label: t.home, Icon: Home},
          {href: '/routes', label: t.routes, Icon: RouteIcon},
          {href: '/manager/history', label: t.history, Icon: History},
          {href: '/manager/more', label: t.more, Icon: MoreHorizontal},
        ]
    : [{href: '/', label: t.home, Icon: Home}, {href: '/routes', label: t.routes, Icon: RouteIcon}, {href: '/settings', label: t.settings, Icon: Settings}]

  return <nav className={`nav app-bottom-nav ${styles.nav}`} aria-label="Primary navigation">
    {links.map(({href, label, Icon}) => {
      const active = href === '/manager' ? pathname === '/manager' : pathname === href || pathname.startsWith(`${href}/`)
      return <Link href={href} key={href} aria-current={active ? 'page' : undefined} className={active ? styles.active : undefined}><Icon size={19} strokeWidth={2.25}/><span>{label}</span></Link>
    })}
  </nav>
}
