'use client'

import Image from 'next/image'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {AlertTriangle, ChevronRight, ClipboardList, History, Home, MapPin, MoreHorizontal, Plus, Route as RouteIcon, Truck, Users} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {currentMembership} from '../../lib/data'
import {loadDashboardSummary} from '../../lib/dashboard'
import {useLocale} from '../../lib/use-preferences'
import NotificationBell from '../notification-bell'
import styles from './manager-dashboard.module.css'

type Summary = {activeRoutes: number; pendingRequests: number; availableDrivers: number; openIssues: number}
type TodayRoute = {id: string; mission_type?: string | null; destination_name?: string | null; status?: string | null; driver_id?: string | null}

const emptySummary: Summary = {activeRoutes: 0, pendingRequests: 0, availableDrivers: 0, openIssues: 0}

export default function Manager() {
  const {t} = useLocale()
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [todayRoutes, setTodayRoutes] = useState<TodayRoute[]>([])
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
        const [{data: userData}, {data: branch}, {data: routes}, dashboard] = await Promise.all([
          client.auth.getUser(),
          client.from('branches').select('name').eq('id', membership.branch_id).maybeSingle(),
          client.from('routes').select('id,mission_type,destination_name,status,driver_id').eq('company_id', membership.company_id).in('status', ['published', 'active', 'paused']).order('position', {ascending: true}).limit(5),
          loadDashboardSummary(),
        ])
        if (cancelled) return
        const metadata = userData.user?.user_metadata as Record<string, unknown> | undefined
        const name = String(metadata?.full_name || metadata?.name || userData.user?.email || '')
        setDisplayName(name)
        setBranchName(String(branch?.name || ''))
        setTodayRoutes((routes || []) as TodayRoute[])
        setSummary(dashboard)
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

  return <main className={`app ${styles.dashboard}`}>
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

    <p className={styles.sectionLabel}>{t.today}</p>
    <section className={`${styles.todayCard} ${hasIssue ? styles.attention : ''}`} aria-live="polite">
      {loading ? <div className={styles.skeleton} aria-label={t.loading} /> : todayRoutes.length ? <div className={styles.todayList}>{todayRoutes.map(route => <div className={styles.todayRow} key={route.id}><span className={styles.todayBadge} /><span className={styles.todayBody}><strong>{route.destination_name || t.destination}</strong><span>{String(route.mission_type || t.delivery).toUpperCase()} · {route.driver_id ? t.assigned : t.pending}</span></span><span className={styles.todayState}>{route.status || t.published}</span></div>)}</div> : <div className={styles.empty}><span className={styles.emptyIcon}><ClipboardList size={27} aria-hidden="true" /></span><div><h2>{hasIssue ? t.attentionRequired : t.noActiveRoutes}</h2><p>{hasIssue ? t.viewIssue : `${t.branchCaughtUp} ${t.greatJob}`}</p></div></div>}
    </section>

    <p className={styles.sectionLabel}>{t.quickActions}</p>
    <section className={styles.actions}>
      <Link className={styles.action} href="/routes"><span className={styles.actionIcon}><Plus size={23} aria-hidden="true" /></span><span className={styles.actionCopy}><strong>{t.createRoute}</strong><span>{t.addDeliveryPickup}</span></span><ChevronRight size={20} aria-hidden="true" /></Link>
      <Link className={styles.action} href="/routes/manage"><span className={styles.actionIcon}><RouteIcon size={21} aria-hidden="true" /></span><span className={styles.actionCopy}><strong>{t.manageRoutes}</strong><span>{t.viewEditRoutes}</span></span><ChevronRight size={20} aria-hidden="true" /></Link>
    </section>

    <nav className={`nav ${styles.nav}`} aria-label="Primary navigation"><Link href="/manager" aria-current="page"><Home size={17} />{t.home}</Link><Link href="/routes"><RouteIcon size={17} />{t.routes}</Link><Link href="/manager/history"><History size={17} />{t.history}</Link><Link href="/manager/more"><MoreHorizontal size={17} />{t.more}</Link></nav>
  </main>
}
