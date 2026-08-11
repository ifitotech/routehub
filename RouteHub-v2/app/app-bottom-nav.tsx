'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Building2, Home, Route as RouteIcon, Settings} from 'lucide-react'
import {useLocale} from '../lib/use-preferences'

/** Shared bottom navigation for pages that do not render their workspace nav. */
export default function AppBottomNav() {
  const pathname = usePathname()
  const {t} = useLocale()
  const hasLocalNav = pathname === '/manager' || pathname === '/operations' || pathname === '/sales' || pathname === '/counter' || pathname.startsWith('/driver')
  if (pathname === '/login' || pathname === '/auth/callback' || hasLocalNav) return null

  const links = pathname.startsWith('/admin')
    ? [{href: '/admin', label: t.home, Icon: Home}, {href: '/admin/companies', label: t.company, Icon: Building2}, {href: '/settings', label: t.settings, Icon: Settings}]
    : [{href: '/', label: t.home, Icon: Home}, {href: '/routes', label: t.routes, Icon: RouteIcon}, {href: '/settings', label: t.settings, Icon: Settings}]

  return <nav className="nav app-bottom-nav" aria-label="Primary navigation">
    {links.map(({href, label, Icon}) => <Link href={href} key={href}><Icon size={17} strokeWidth={2.2}/><span>{label}</span></Link>)}
  </nav>
}
