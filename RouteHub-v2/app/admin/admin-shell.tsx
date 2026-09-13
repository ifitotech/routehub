'use client'

import Link from 'next/link'
import styles from './admin.module.css'

export type AdminSection = 'home' | 'companies' | 'billing' | 'errors' | 'support' | 'admins' | 'audit'

const nav: {id: AdminSection; href: string; label: string}[] = [
  {id: 'home', href: '/admin', label: 'Home'},
  {id: 'companies', href: '/admin/companies', label: 'Companies'},
  {id: 'billing', href: '/admin/billing', label: 'Billing'},
  {id: 'errors', href: '/admin/errors', label: 'Errors'},
  {id: 'support', href: '/admin/support', label: 'Support'},
  {id: 'admins', href: '/admin/admins', label: 'Admins'},
  {id: 'audit', href: '/admin/audit', label: 'Audit'},
]

// Every Admin page used to render its own <nav> at the bottom independently
// - only the home page actually had one, so navigating anywhere else lost
// the menu entirely and "Back" links were the only way to move around.
// One shared shell keeps it present everywhere.
export default function AdminShell({children, active}: {children: React.ReactNode; active: AdminSection}) {
  return (
    <main className="app">
      <div className={styles.page}>{children}</div>
      <nav className={styles.nav} aria-label="Admin navigation">
        {nav.map(item => <Link key={item.id} href={item.href} data-active={active === item.id ? 'true' : 'false'}>{item.label}</Link>)}
      </nav>
    </main>
  )
}
