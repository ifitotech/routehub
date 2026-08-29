 'use client'
import {Building2, ChevronRight, ScrollText, ShieldCheck, UserCheck, AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import styles from './admin.module.css'

const quickLinks = [
  {href: '/admin/approvals', title: 'Access requests', description: 'Approve or reject manager accounts.', icon: UserCheck},
  {href: '/admin/companies', title: 'Companies', description: 'Review registered workspaces.', icon: Building2},
  {href: '/admin/audit', title: 'Audit log', description: 'See recent security actions.', icon: ScrollText},
]

export default function Admin() {
  const [counts, setCounts] = useState({pending: 0, companies: 0, alerts: 0})
  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const [{data: requests}, {count: companies}] = await Promise.all([
        supabase.from('platform_manager_approvals').select('status'),
        supabase.from('companies').select('id', {count: 'exact', head: true}),
      ])
      setCounts({
        pending: (requests || []).filter(row => row.status === 'pending').length,
        companies: companies || 0,
        alerts: 0,
      })
    }
    void load()
  }, [])
  return <main className="app"><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>CEO / Admin</p><h1 className={styles.title}>Admin access</h1><p className={styles.subtitle}>Approve accounts and keep RouteHub secure.</p></div></header>
    <section className={styles.adminStats} aria-label="Platform summary"><article><span>Pending approvals</span><strong>{counts.pending}</strong><small>Needs review</small></article><article><span>Active companies</span><strong>{counts.companies}</strong><small>Registered workspaces</small></article><article className={styles.alertStat}><span>System alerts</span><strong>{counts.alerts}</strong><small>Needs attention</small></article></section>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>Access requests</h2><p>Review real email accounts before granting access.</p></div><span className={styles.panelIcon}><ShieldCheck size={21}/></span></header><div className={styles.empty}><span><UserCheck size={24}/></span><h2>{counts.pending ? `${counts.pending} pending request${counts.pending === 1 ? '' : 's'}` : 'No pending requests'}</h2><p>{counts.pending ? 'Review them before the trial ends.' : 'New manager requests will appear here.'}</p><Link className={styles.primaryButton} href="/admin/approvals">Open requests <ChevronRight size={17}/></Link></div></section>
    <h2 className={styles.sectionLabel}>Quick access</h2><section className={styles.grid} aria-label="Admin quick access">{quickLinks.map(({href, title, description, icon: Icon}) => <Link className={styles.actionCard} href={href} key={href}><span className={styles.actionIcon}><Icon size={20}/></span><h3>{title}</h3><p>{description}</p><ChevronRight className={styles.arrow} size={18}/></Link>)}</section>
    <div className={styles.adminNotice}><AlertTriangle size={18}/><span>Admin access is limited to platform security and account approvals.</span></div>
    <nav className={styles.nav} aria-label="Admin navigation"><Link href="/admin">Home</Link><Link href="/admin/approvals">Requests</Link><Link href="/admin/companies">Companies</Link><Link href="/admin/audit">Audit</Link></nav>
  </div></main>
}
