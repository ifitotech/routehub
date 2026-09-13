'use client'
import {AlertTriangle, Building2, ChevronRight, CreditCard, LifeBuoy, ScrollText, ShieldCheck, UserCheck} from 'lucide-react'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import AdminShell from './admin-shell'
import styles from './admin.module.css'

const quickLinks = [
  {href: '/admin/companies', title: 'Companies', description: 'Review registered workspaces.', icon: Building2},
  {href: '/admin/billing', title: 'Billing', description: 'Plans, subscription status and trials.', icon: CreditCard},
  {href: '/admin/errors', title: 'Errors', description: 'Crashes reported from every company.', icon: AlertTriangle},
  {href: '/admin/support', title: 'Support', description: 'Requests sent from Settings.', icon: LifeBuoy},
  {href: '/admin/admins', title: 'Platform admins', description: 'Who has CEO-level access.', icon: ShieldCheck},
  {href: '/admin/audit', title: 'Audit log', description: 'See recent security actions.', icon: ScrollText},
]

export default function Admin() {
  const [counts, setCounts] = useState({pending: 0, companies: 0, errors: 0, support: 0})
  const [activity, setActivity] = useState({routes: 0, drivers: 0, managers: 0})
  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const [{data: requests}, {count: companies}, {count: errors}, {count: support}, {count: routes}, {data: roles}] = await Promise.all([
        supabase.from('platform_manager_approvals').select('status'),
        supabase.from('companies').select('id', {count: 'exact', head: true}),
        supabase.from('app_error_reports').select('id', {count: 'exact', head: true}).is('resolved_at', null),
        supabase.from('support_requests').select('id', {count: 'exact', head: true}).is('resolved_at', null),
        supabase.from('routes').select('id', {count: 'exact', head: true}),
        supabase.from('company_users').select('role'),
      ])
      setCounts({
        pending: (requests || []).filter(row => row.status === 'pending').length,
        companies: companies || 0,
        errors: errors || 0,
        support: support || 0,
      })
      setActivity({
        routes: routes || 0,
        drivers: (roles || []).filter(row => row.role === 'driver').length,
        managers: (roles || []).filter(row => ['branch_manager', 'operations_manager'].includes(row.role)).length,
      })
    }
    void load()
  }, [])
  return (
    <AdminShell active="home">
      <header className={styles.header}><div><p className={styles.eyebrow}>CEO / Admin</p><h1 className={styles.title}>Admin access</h1><p className={styles.subtitle}>Approve accounts, manage billing and keep RouteHub healthy.</p></div></header>
      <section className={styles.adminStats} aria-label="Platform summary">
        <article><span>Pending trials</span><strong>{counts.pending}</strong><small>Needs review</small></article>
        <article><span>Companies</span><strong>{counts.companies}</strong><small>Registered workspaces</small></article>
        <article className={counts.errors > 0 ? styles.alertStat : undefined}><span>Open errors</span><strong>{counts.errors}</strong><small>Needs attention</small></article>
      </section>
      <h2 className={styles.sectionLabel}>Platform activity</h2>
      <section className={styles.adminStats} aria-label="Platform activity">
        <article><span>Routes created</span><strong>{activity.routes}</strong><small>All-time, every company</small></article>
        <article><span>Drivers</span><strong>{activity.drivers}</strong><small>Across every company</small></article>
        <article><span>Managers</span><strong>{activity.managers}</strong><small>Branch &amp; operations managers</small></article>
      </section>
      {counts.errors > 0 && (
        <section className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Open errors</h2><p>Something crashed for a real user and has not been looked at yet.</p></div><span className={styles.panelIcon}><AlertTriangle size={21}/></span></header>
          <div className={styles.empty}><span><AlertTriangle size={24}/></span><h2>{counts.errors} open error{counts.errors === 1 ? '' : 's'}</h2><p>Copy one and hand it over to get it fixed.</p><Link className={styles.primaryButton} href="/admin/errors">Open errors <ChevronRight size={17}/></Link></div>
        </section>
      )}
      {counts.support > 0 && (
        <section className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Support requests</h2><p>Sent from Settings &gt; Contact support and waiting on a reply.</p></div><span className={styles.panelIcon}><LifeBuoy size={21}/></span></header>
          <div className={styles.empty}><span><LifeBuoy size={24}/></span><h2>{counts.support} open request{counts.support === 1 ? '' : 's'}</h2><p>See what each company asked for.</p><Link className={styles.primaryButton} href="/admin/support">Open support <ChevronRight size={17}/></Link></div>
        </section>
      )}
      <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>Access requests</h2><p>Review trial signups and company plans.</p></div><span className={styles.panelIcon}><ShieldCheck size={21}/></span></header>
        <div className={styles.empty}><span><UserCheck size={24}/></span><h2>{counts.pending ? `${counts.pending} pending request${counts.pending === 1 ? '' : 's'}` : 'No pending requests'}</h2><p>{counts.pending ? 'Review them before the trial ends.' : 'New trial signups will appear here.'}</p><Link className={styles.primaryButton} href="/admin/billing">Open billing <ChevronRight size={17}/></Link></div>
      </section>
      <h2 className={styles.sectionLabel}>Quick access</h2>
      <section className={styles.grid} aria-label="Admin quick access">{quickLinks.map(({href, title, description, icon: Icon}) => <Link className={styles.actionCard} href={href} key={href}><span className={styles.actionIcon}><Icon size={20}/></span><h3>{title}</h3><p>{description}</p><ChevronRight className={styles.arrow} size={18}/></Link>)}</section>
      <div className={styles.adminNotice}><AlertTriangle size={18}/><span>Admin access is limited to platform security, billing and account approvals.</span></div>
    </AdminShell>
  )
}
