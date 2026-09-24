'use client'

import Image from 'next/image'
import Link from 'next/link'
import {AlertTriangle, Building2, Home, LifeBuoy, ScrollText, Settings, ShieldCheck} from 'lucide-react'
import styles from './admin.module.css'

export type AdminSection = 'home' | 'companies' | 'billing' | 'errors' | 'support' | 'admins' | 'audit' | 'settings'

const nav: {id: AdminSection; href: string; label: string; icon: typeof Home}[] = [
  {id: 'home', href: '/admin', label: 'Home', icon: Home},
  {id: 'companies', href: '/admin/companies', label: 'Companies', icon: Building2},
  {id: 'errors', href: '/admin/errors', label: 'Errors', icon: AlertTriangle},
  {id: 'support', href: '/admin/support', label: 'Support', icon: LifeBuoy},
  {id: 'admins', href: '/admin/admins', label: 'Admins', icon: ShieldCheck},
  {id: 'audit', href: '/admin/audit', label: 'Audit', icon: ScrollText},
  {id: 'settings', href: '/admin/settings', label: 'Settings', icon: Settings},
]

// Every Admin page used to render its own <nav> at the bottom independently
// - only the home page actually had one, so navigating anywhere else lost
// the menu entirely and "Back" links were the only way to move around.
// One shared shell keeps it present everywhere.
export default function AdminShell({children, active}: {children: React.ReactNode; active: AdminSection}) {
  return (
    <>
      <header className={styles.topBar}>
        <Link href="/admin" className={styles.topBrand}>
          <Image src="/routehub-regular-new.jpg" alt="" width={30} height={30} />
          <span>RouteHub</span>
        </Link>
        <span className={styles.topTag}>CEO Admin</span>
      </header>
      <main className="app">
        <div className={styles.page}>{children}</div>
        <nav className={styles.nav} aria-label="Admin navigation">
          {nav.map(({id, href, label, icon: Icon}) => <Link key={id} href={href} data-active={active === id ? 'true' : 'false'} aria-current={active === id ? 'page' : undefined}><Icon size={16}/><span>{label}</span></Link>)}
        </nav>
      </main>
    </>
  )
}
