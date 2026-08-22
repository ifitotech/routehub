'use client'

import Image from 'next/image'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {AlertTriangle, ChevronDown, ChevronRight, ClipboardList, History, Home, MapPin, MoreHorizontal, Plus, Route as RouteIcon, Truck, Users} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {currentMembership} from '../../lib/data'
import {loadManagerDashboard, managerOperationalDate, type DashboardRoute, type DashboardSummary} from '../../lib/dashboard'
import {useLocale} from '../../lib/use-preferences'
import NotificationBell from '../notification-bell'
import TemporaryRouteAssignments from '../temporary-route-assignments'
import LiveRoute from '../routes/live-route'
import styles from './manager-dashboard.module.css'

const emptySummary: DashboardSummary = {activeRoutes: 0, pendingRequests: 0, availableDrivers: 0, openIssues: 0}

export default function Manager() {
  const {t} = useLocale()
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary)
  const [todayRoutes, setTodayRoutes] = useState<DashboardRoute[]>([])
  const [companyId, setCompanyId] = useState('')
  const [dashboardBranchId, setDashboardBranchId] = useState<string | null>(null)
  const [branchName, setBranchName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const membership = await currentMembership()
        const client = getSupabase()
        const branchQuery = membership.branch_id
          ? client.from('branches').select('id,name').eq('id', membership.branch_id).maybeSingle()
          : client.from('branches').select('id,name').eq('company_id', membership.company_id).order('name').limit(1).maybeSingle()
        const [{data: userData, error: userError}, {data: branch, error: branchError}] = await Promise.all([
          client.auth.getUser(),
          branchQuery,
        ])
        if (userError || branchError) throw userError || branchError
        // /manager is a branch workspace. A branch-bound membership uses its
        // exact branch; a legacy unbound Manager is anchored to the first
        // authorized branch returned by RLS rather than mixing all branches.
        const branchId = String(branch?.id || membership.branch_id || '') || null
        setCompanyId(membership.company_id)
        setDashboardBranchId(branchId)
        const dashboard = await loadManagerDashboard({
          companyId: membership.company_id,
          branchId,
          routeDate: managerOperationalDate(),
        })
        if (cancelled) return
        const metadata = userData.user?.user_metadata as Record<string, unknown> | undefined
        const name = String(metadata?.full_name || metadata?.name || userData.user?.email || '')
        setDisplayName(name)
        setBranchName(String(branch?.name || ''))
        setTodayRoutes(dashboard.todayRoutes.slice(0, 5))
        setSummary(dashboard.summary)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t.unableLoadReports)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [t.unableLoadReports])

  const metrics = [
    {label: t.activeRoutes, value: summary.activeRoutes, note: t.inProgress, href: '/routes', Icon: Truck, tone: 'blue'},
    {label: t.activeDrivers, value: summary.availableDrivers, note: t.connected, href: '/manager/team', Icon: Users, tone: 'purple'},
    {label: t.pendingRequests, value: summary.pendingRequests, note: t.waitingDispatch, href: '/requests', Icon: ClipboardList, tone: 'amber'},
    {label: t.issues, value: summary.openIssues, note: t.requireAttention, href: '/reports', Icon: AlertTriangle, tone: 'red'},
  ] as const
  const hasIssue = summary.openIssues > 0
  const branchHealthy = !hasIssue
  const greetingName = displayName ? displayName.split('@')[0] : t.managerRole

  const updatedAt = new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit'}).format(new Date())

  return <main className={`app ${styles.dashboard}`}>
    <aside className={styles.desktopSidebar} aria-label="Manager navigation">
      <Link href="/manager" className={styles.sidebarBrand} aria-label="RouteHub manager dashboard">
        <Image src="/routehub-regular-new.jpg" alt="" width={40} height={40} priority />
        <span>Route<em>Hub</em></span>
      </Link>
      <nav className={styles.sidebarNav} aria-label="Primary">
        <Link href="/manager" aria-current="page"><Home size={20}/><span>Today</span></Link>
        <Link href="/routes"><RouteIcon size={20}/><span>Routes</span></Link>
        <Link href="/manager/team"><Users size={20}/><span>Drivers</span></Link>
        <Link href="/manager/history"><History size={20}/><span>History</span></Link>
      </nav>
      <Link href="/routes?new=1" className={styles.newRoute}><Plus size={20}/>New Route</Link>
      <Link href="/manager/more" className={styles.sidebarProfile}><span className={styles.sidebarAvatar}>{greetingName.slice(0, 2).toUpperCase()}</span><span><strong>{greetingName || 'Manager'}</strong><small>Branch Manager</small></span><ChevronDown size={16}/></Link>
    </aside>

    <section className={styles.workspace}>
    <header className={styles.desktopTop}>
      <h1>Today Overview</h1>
      <span>Last updated: {updatedAt}</span>
    </header>
    <header className={styles.header}>
      <Link href="/manager" className={styles.brand} aria-label="RouteHub home">
        <Image src="/routehub-regular-new.jpg" alt="" width={40} height={40} priority />
        <span>Route<em>Hub</em></span>
      </Link>
      <NotificationBell />
    </header>

    <section className={styles.intro}>
      <h1>{t.helloPrefix} {greetingName} 👋</h1>
      <p>{t.operationGlance}</p>
    </section>

    <div className={styles.branch} aria-label={`${branchName || t.mainBranch}: ${branchHealthy ? t.allSystemsNormal : t.requireAttention}`}>
      <span className={styles.branchIcon}><MapPin size={19} aria-hidden="true" /></span>
      <span className={styles.branchMain}><span className={styles.branchName}>{branchName || t.mainBranch}</span><span className={styles.branchStatus}><i className={`${styles.healthyDot} ${hasIssue ? styles.issueDot : ''}`} />{branchHealthy ? t.allSystemsNormal : t.requireAttention}</span></span>
      <ChevronRight size={19} aria-hidden="true" />
    </div>

    {error && <p className={styles.error} role="status">{error}</p>}

    <section className={styles.metricGrid} aria-label={t.branchMetrics}>
      {metrics.map(({label, value, note, href, Icon, tone}) => <Link className={`${styles.metric} ${styles[tone]}`} href={href} key={label} aria-label={`${label}: ${value}`}>
        <span className={styles.metricIcon}><Icon size={20} aria-hidden="true" /></span><strong className={styles.metricValue}>{loading ? '—' : value}</strong><span className={styles.metricChevron}><ChevronRight size={21} aria-hidden="true" /></span><span className={styles.metricLabel}>{label}</span><span className={styles.metricNote}>{note}</span>
      </Link>)}
    </section>

    <section className={styles.mobileLiveCard} aria-label="Live operations">
      <div className={styles.mobileLiveTop}><span className={styles.mobileLiveIcon}><Truck size={20} /></span><div><span className={styles.mobileLiveEyebrow}>LIVE OPERATIONS</span><h2>Operations at a glance</h2></div><span className={styles.liveStatus}><i />Live</span></div>
      <div className={styles.mobileLiveStats}><span><strong>{loading ? '—' : summary.activeRoutes}</strong> active routes</span><span><strong>{loading ? '—' : summary.availableDrivers}</strong> drivers online</span></div>
      <Link className={styles.mobileLiveCta} href="/routes/live"><MapPin size={18} />Open live map<ChevronRight size={18} /></Link>
    </section>

    <section className={styles.desktopLower}>
    <div className={styles.desktopRoutesPanel}>
    <div className={styles.desktopPanelHeader}><h2>Active Routes</h2><Link href="/routes">View all</Link></div>
    <section className={`${styles.todayCard} ${hasIssue ? styles.attention : ''}`} aria-live="polite">
      {loading ? <div className={styles.skeleton} aria-label={t.loading} /> : todayRoutes.length ? <div className={styles.todayList}>{todayRoutes.map(route => <div className={styles.todayRow} key={route.id}><span className={styles.todayBadge} /><span className={styles.todayBody}><strong>{route.destination_name || t.destination}</strong><span>{String(route.mission_type || t.delivery).toUpperCase()} · {route.driver_id ? t.assigned : t.pending}</span></span><span className={styles.todayState}>{route.status || t.published}</span></div>)}</div> : <div className={styles.empty}><span className={styles.emptyIcon}><ClipboardList size={27} aria-hidden="true" /></span><div><h2>{t.noRoutesToday}</h2><p>{t.createRouteWhenReady}</p><Link className={styles.emptyCta} href="/routes">{t.createRoute}</Link></div></div>}
    </section>
    </div>
    <div className={styles.desktopMapPanel}>
      <div className={styles.desktopPanelHeader}><h2>Live Map</h2><Link href="/routes/live">View all</Link></div>
      <LiveRoute companyId={companyId} branchId={dashboardBranchId} showToday={false}/>
    </div>
    </section>

    <p className={styles.sectionLabel}>{t.quickActions}</p>
    <section className={styles.actions}>
      <Link className={styles.action} href="/routes"><span className={styles.actionIcon}><Plus size={23} aria-hidden="true" /></span><span className={styles.actionCopy}><strong>{t.createRoute}</strong><span>{t.addDeliveryPickup}</span></span><ChevronRight size={20} aria-hidden="true" /></Link>
      <Link className={styles.action} href="/routes/manage"><span className={styles.actionIcon}><RouteIcon size={21} aria-hidden="true" /></span><span className={styles.actionCopy}><strong>{t.manageRoutes}</strong><span>{t.viewEditRoutes}</span></span><ChevronRight size={20} aria-hidden="true" /></Link>
    </section>

    <div className={styles.desktopOnly}><TemporaryRouteAssignments /></div>
    <nav className={`nav ${styles.nav}`} aria-label="Primary navigation"><Link href="/manager" aria-current="page"><Home size={17} />{t.home}</Link><Link href="/routes"><RouteIcon size={17} />{t.routes}</Link><Link href="/manager/history"><History size={17} />{t.history}</Link><Link href="/manager/more"><MoreHorizontal size={17} />{t.more}</Link></nav>
    </section>
  </main>
}
