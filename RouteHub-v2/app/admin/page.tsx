'use client'
import {AlertTriangle, Building2, ChevronRight, LifeBuoy, Radio, RefreshCw, Route, ScrollText, ShieldCheck, UserCheck, UsersRound} from 'lucide-react'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import AdminShell from './admin-shell'
import styles from './admin.module.css'

const quickLinks = [
  {href: '/admin/companies', title: 'Companies', description: 'Review registered workspaces.', icon: Building2},
  {href: '/admin/errors', title: 'Errors', description: 'Crashes reported from every company.', icon: AlertTriangle},
  {href: '/admin/support', title: 'Support', description: 'Requests sent from Settings.', icon: LifeBuoy},
  {href: '/admin/admins', title: 'Platform admins', description: 'Who has CEO-level access.', icon: ShieldCheck},
  {href: '/admin/audit', title: 'Audit log', description: 'See recent security actions.', icon: ScrollText},
]

export default function Admin() {
  const [counts, setCounts] = useState({pending: 0, companies: 0, errors: 0, support: 0})
  const [activity, setActivity] = useState({activeRoutes: 0, issues: 0, drivers: 0, managers: 0})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const supabase = getSupabase()
      const [{data: requests, error: requestError}, {count: companies, error: companyError}, {count: errors, error: errorCountError}, {count: support, error: supportError}, {count: activeRoutes, error: activeRouteError}, {count: issues, error: issueError}, {data: roles, error: roleError}] = await Promise.all([
        supabase.from('platform_manager_approvals').select('status'),
        supabase.from('companies').select('id', {count: 'exact', head: true}),
        supabase.from('app_error_reports').select('id', {count: 'exact', head: true}).is('resolved_at', null),
        supabase.from('support_requests').select('id', {count: 'exact', head: true}).is('resolved_at', null),
        supabase.from('routes').select('id', {count: 'exact', head: true}).in('status', ['active', 'paused']),
        supabase.from('routes').select('id', {count: 'exact', head: true}).eq('status', 'issue'),
        supabase.from('company_users').select('role'),
      ])
      const queryError = requestError || companyError || errorCountError || supportError || activeRouteError || issueError || roleError
      if (queryError) throw queryError
      setCounts({
        pending: (requests || []).filter(row => row.status === 'pending').length,
        companies: companies || 0,
        errors: errors || 0,
        support: support || 0,
      })
      setActivity({
        activeRoutes: activeRoutes || 0,
        issues: issues || 0,
        drivers: (roles || []).filter(row => row.role === 'driver').length,
        managers: (roles || []).filter(row => ['branch_manager', 'operations_manager'].includes(row.role)).length,
      })
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load platform data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])
  return (
    <AdminShell active="home">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>CEO / Admin</p><h1 className={styles.title}>Platform control</h1><p className={styles.subtitle}>The operational view for pilot companies, support and platform reliability. Billing stays separate until it is enabled.</p></div>
        <button className={styles.refreshButton} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? styles.spinning : undefined}/>{loading ? 'Updating…' : 'Refresh'}</button>
      </header>
      {loadError ? <section className={styles.loadError} role="alert"><AlertTriangle size={19}/><div><strong>Platform data could not be refreshed.</strong><p>{loadError}</p></div><button className={styles.secondaryButton} type="button" onClick={() => void load()}>Try again</button></section> : <>
        <section className={styles.controlHero} aria-label="Platform health">
          <div><span className={styles.controlHeroIcon}><Radio size={18}/></span><p>Platform health</p><h2>{counts.errors || counts.support ? 'Needs attention' : 'All clear'}</h2><small>{counts.errors ? `${counts.errors} open error${counts.errors === 1 ? '' : 's'}` : counts.support ? `${counts.support} support request${counts.support === 1 ? '' : 's'} waiting` : 'No unresolved errors or support requests.'}</small></div>
          <div className={styles.controlHeroActions}><Link href={counts.errors ? '/admin/errors' : counts.support ? '/admin/support' : '/admin/companies'}>{counts.errors ? 'Review errors' : counts.support ? 'Review support' : 'Review companies'}<ChevronRight size={16}/></Link></div>
        </section>
        <section className={styles.adminStats} aria-label="Platform summary">
          <article><span>Pending access</span><strong>{counts.pending}</strong><small>Trial requests to review</small></article>
          <article><span>Companies</span><strong>{counts.companies}</strong><small>Registered workspaces</small></article>
          <Link href="/admin/errors" className={`${styles.adminStatLink} ${counts.errors > 0 ? styles.alertStat : ''}`} aria-label={`Open errors: ${counts.errors}`}><span>Open errors</span><strong>{counts.errors}</strong><small>{counts.errors ? 'Needs attention' : 'Nothing unresolved'}</small></Link>
        </section>
        <h2 className={styles.sectionLabel}>Platform activity</h2>
        <section className={`${styles.adminStats} ${styles.adminActivityStats}`} aria-label="Platform activity">
          <article><span><Route size={15}/> Active routes</span><strong>{activity.activeRoutes}</strong><small>Drivers currently working</small></article>
          <Link href="/admin/companies" className={`${styles.adminStatLink} ${activity.issues > 0 ? styles.alertStat : ''}`}><span><AlertTriangle size={15}/> Route issues</span><strong>{activity.issues}</strong><small>{activity.issues ? 'Manager review required' : 'No unresolved route issues'}</small></Link>
          <article><span><UsersRound size={15}/> Drivers</span><strong>{activity.drivers}</strong><small>Across every company</small></article>
          <article><span><UsersRound size={15}/> Managers</span><strong>{activity.managers}</strong><small>Branch &amp; operations managers</small></article>
        </section>
      </>}
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
          <div className={styles.empty}><span><UserCheck size={24}/></span><h2>{counts.pending ? `${counts.pending} pending request${counts.pending === 1 ? '' : 's'}` : 'No pending requests'}</h2><p>{counts.pending ? 'Review them before the trial ends.' : 'New trial signups will appear here.'}</p><Link className={styles.primaryButton} href="/admin/companies">Review companies <ChevronRight size={17}/></Link></div>
      </section>
      <h2 className={styles.sectionLabel}>Quick access</h2>
      <section className={styles.grid} aria-label="Admin quick access">{quickLinks.map(({href, title, description, icon: Icon}) => <Link className={styles.actionCard} href={href} key={href}><span className={styles.actionIcon}><Icon size={20}/></span><h3>{title}</h3><p>{description}</p><ChevronRight className={styles.arrow} size={18}/></Link>)}</section>
      <div className={styles.adminNotice}><AlertTriangle size={18}/><span>Admin access is limited to platform security, billing and account approvals.</span></div>
    </AdminShell>
  )
}
