'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useLocale} from '../lib/use-preferences'

/** Shared bottom navigation for pages that do not render their workspace nav. */
export default function AppBottomNav() {
  const pathname = usePathname()
  const {t} = useLocale()
  const hasLocalNav = pathname === '/manager' || pathname === '/operations' || pathname === '/sales' || pathname === '/counter' || pathname.startsWith('/driver')
  if (pathname === '/login' || pathname === '/auth/callback' || hasLocalNav) return null

  const links = pathname.startsWith('/admin')
    ? [{href: '/admin', label: t.home}, {href: '/admin/companies', label: t.company}, {href: '/settings', label: t.settings}]
    : [{href: '/', label: t.home}, {href: '/routes', label: t.routes}, {href: '/settings', label: t.settings}]

  return <nav className="nav app-bottom-nav" aria-label="Primary navigation">
    {links.map(link => <Link href={link.href} key={link.href}>{link.label}</Link>)}
  </nav>
}
