'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {AlertTriangle, ChevronRight, ClipboardList, FileText, Plus, Truck, Users} from 'lucide-react'
import {loadDashboardSummary} from '../../lib/dashboard'
import {useLocale} from '../../lib/use-preferences'

const emptySummary = {activeRoutes: 0, pendingRequests: 0, availableDrivers: 0, openIssues: 0}

export default function Manager() {
  const [summary, setSummary] = useState(emptySummary)
  const [loading, setLoading] = useState(true)
  const {t} = useLocale()
  useEffect(() => { loadDashboardSummary().then(setSummary).catch(() => {}).finally(() => setLoading(false)) }, [])
  const metrics = [
    [t.activeRoutes, summary.activeRoutes, Truck, 'blue', t.inProgress], [t.activeDrivers, summary.availableDrivers, Users, 'blue', t.connected],
    [t.pendingRequests, summary.pendingRequests, ClipboardList, 'amber', t.waitingDispatch], [t.issues, summary.openIssues, AlertTriangle, 'red', t.requireAttention],
  ] as const
  return <main className="app manager-dashboard">
    <header className="topbar"><Link className="brand" href="/">ROUTEHUB</Link><div className="avatar">MG</div></header>
    <section className="manager-intro"><p className="eyebrow">{t.managerRole.toUpperCase()}</p><h1>{t.helloManager}</h1><p className="muted">{t.operationGlance}</p></section>
    <section className="metric-grid" aria-label={t.branchMetrics}>{metrics.map(([label, value, Icon, tone, note]) => <article className={`metric-card metric-${tone}`} key={label}><span className="metric-icon"><Icon size={18}/></span><small>{label}</small><strong>{loading ? '—' : value}</strong><span className="metric-note">{note}</span></article>)}</section>
    <section className="manager-panel"><div className="section-heading"><div><h2>{t.quickActions}</h2><p className="muted">{t.keepMoving}</p></div></div><div className="quick-grid"><Link className="quick-action primary" href="/routes"><Plus size={19}/>{t.createRoute}</Link><Link className="quick-action" href="/routes/manage"><Truck size={19}/>{t.manageRoutes}</Link><Link className="quick-action" href="/requests"><FileText size={19}/>{t.requests}</Link><Link className="quick-action" href="/contacts"><Users size={19}/>{t.contacts}</Link></div></section>
    <section className="manager-panel activity-panel"><div className="section-heading"><div><h2>{t.branchTools}</h2><p className="muted">{t.branchToolsHelp}</p></div></div>{[[t.team, '/manager/team'], [t.branches, '/manager/branches'], [t.invitations, '/manager/invitations'], [t.reports, '/reports']].map(([label, href]) => <Link className="tool-row" href={href} key={href}><span>{label}</span><ChevronRight size={18}/></Link>)}</section>
    <nav className="nav"><Link href="/manager">{t.home}</Link><Link href="/routes">{t.routes}</Link><Link href="/requests">{t.requests}</Link><Link href="/settings">{t.more}</Link></nav>
  </main>
}
