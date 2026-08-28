'use client'

import Image from 'next/image'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {AlertTriangle, ArrowRight, History, Home, MoreHorizontal, Plus, Route as RouteIcon, Users} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {currentMembership} from '../../lib/data'
import {loadManagerDashboard, managerOperationalDate, type DashboardRoute, type DashboardSummary} from '../../lib/dashboard'
import {useLocale} from '../../lib/use-preferences'
import NotificationBell from '../notification-bell'
import TemporaryRouteAssignments from '../temporary-route-assignments'
import LiveRoute from '../routes/live-route'
import ManagerShell from './manager-shell'
import styles from './manager-dashboard.module.css'
import todayStyles from './manager-today.module.css'

const emptySummary: DashboardSummary = {activeRoutes: 0, pendingRoutes: 0, completedRoutes: 0, openIssues: 0}

export default function Manager() {
  const {locale,t} = useLocale()
  const copy = locale === 'es' ? {
    today: 'Hoy', todayOverview: 'Operación de hoy', liveOperations: 'Operación en vivo', active: 'Activas', pending: 'Pendientes', completed: 'Completadas', issues: 'Incidencias',
    liveDescription: 'Lo que está ocurriendo en tu sucursal ahora.', quickActions: 'Acciones rápidas',
    upcoming: 'Próximas rutas', attention: 'Atención necesaria', viewAll: 'Ver todas', viewRoute: 'Ver ruta', viewMap: 'Ver en mapa',
    newRoute: 'Nueva ruta', reorder: 'Reordenar rutas', addContact: 'Agregar contacto', noPending: 'No hay rutas pendientes.',
    assignment: 'Asignado', waiting: 'Pendiente', issue: 'incidencia abierta', review: 'Revisa los reportes de ruta.',
    branchManager: 'Manager de sucursal', currentBranch: 'Sucursal actual', updated: 'Actualizado',
  } : locale === 'fr' ? {
    today: 'Aujourd’hui', todayOverview: 'Opérations du jour', liveOperations: 'Opération en direct', active: 'Actifs', pending: 'En attente', completed: 'Terminés', issues: 'Incidents',
    liveDescription: 'Ce qui se passe dans votre succursale maintenant.', quickActions: 'Actions rapides',
    upcoming: 'Prochains itinéraires', attention: 'Attention requise', viewAll: 'Voir tout', viewRoute: 'Voir l’itinéraire', viewMap: 'Voir sur la carte',
    newRoute: 'Nouvel itinéraire', reorder: 'Réordonner', addContact: 'Ajouter un contact', noPending: 'Aucun itinéraire en attente.',
    assignment: 'Assigné', waiting: 'En attente', issue: 'incident ouvert', review: 'Consultez les rapports.',
    branchManager: 'Manager de succursale', currentBranch: 'Succursale actuelle', updated: 'Mis à jour',
  } : {
    today: 'Today', todayOverview: 'Today’s operations', liveOperations: 'Live operation', active: 'Active', pending: 'Pending', completed: 'Completed', issues: 'Issues',
    liveDescription: 'What is happening in your branch right now.', quickActions: 'Quick actions',
    upcoming: 'Upcoming routes', attention: 'Attention needed', viewAll: 'View all', viewRoute: 'View route', viewMap: 'View on map',
    newRoute: 'New route', reorder: 'Reorder routes', addContact: 'Add contact', noPending: 'No pending routes.',
    assignment: 'Assigned', waiting: 'Pending', issue: 'open issue', review: 'Review route reports.',
    branchManager: 'Branch Manager', currentBranch: 'Current branch', updated: 'Updated',
  }
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
        // The dashboard list is a dispatch reference: active/completed routes
        // have their own Live Operations and History surfaces.
        setTodayRoutes(dashboard.todayRoutes.filter(route => ['published', 'pending', 'draft'].includes(route.status)).slice(0, 5))
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
    {label: copy.active, value: summary.activeRoutes, href: '/routes', tone: todayStyles.summaryActive},
    {label: copy.pending, value: summary.pendingRoutes, href: '/routes', tone: todayStyles.summaryPending},
    {label: copy.completed, value: summary.completedRoutes, href: '/manager/history', tone: todayStyles.summaryCompleted},
    {label: copy.issues, value: summary.openIssues, href: '/reports', tone: todayStyles.summaryIssues},
  ] as const
  const hasIssue = summary.openIssues > 0
  const greetingName = displayName ? displayName.split('@')[0] : t.managerRole
  const operationalDate = managerOperationalDate()
  const dateLabel = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : locale === 'fr' ? 'fr-FR' : 'en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'}).format(new Date(`${operationalDate}T12:00:00`))
  const routeTypeLabel = (value?: string | null) => value === 'pickup' ? t.pickup : value === 'delivery' ? t.delivery : value === 'return' ? t.returnToBranch : value || t.route

  return <ManagerShell active="today" branchName={branchName || t.mainBranch} displayName={greetingName || 'Manager'} roleLabel={copy.branchManager}>
    <header className={styles.desktopTop}><div><h1>{copy.today}</h1><p className={todayStyles.headerDate}>{dateLabel} · {branchName || t.mainBranch}</p></div><div className={styles.desktopTopMeta}><span>{copy.updated}: {new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit'}).format(new Date())}</span><NotificationBell /><span className={styles.desktopGreeting}>{greetingName || 'Manager'}</span></div></header>
    <header className={styles.header}><Link href="/manager" className={styles.brand} aria-label="RouteHub home"><Image src="/routehub-regular-new.jpg" alt="" width={40} height={40} priority /><span>Route<em>Hub</em></span></Link><NotificationBell /></header>
    <section className={styles.intro}><h1>{copy.today}</h1><p>{dateLabel} · {branchName || t.mainBranch}</p></section>
    {error && <p className={styles.error} role="status">{error}</p>}
    <section className={todayStyles.summary} aria-label={t.branchMetrics}>{metrics.map(({label,value,href,tone}) => <Link className={`${todayStyles.summaryCard} ${tone}`} href={href} key={label} aria-label={`${label}: ${value}`}><strong>{loading ? '—' : value}</strong><span>{label}</span></Link>)}</section>
    <div className={todayStyles.todayLayout}>
      <main className={todayStyles.todayMain}>
        <div className={todayStyles.sectionHeading}><div><span>{copy.liveOperations}</span><h2>{copy.liveDescription}</h2></div><span className={todayStyles.scope}>{branchName || t.mainBranch}</span></div>
        <LiveRoute companyId={companyId} branchId={dashboardBranchId} showToday={false} compact />
      </main>
      <aside className={todayStyles.todaySide}>
        <section className={todayStyles.sideCard} aria-label={copy.quickActions}><div className={todayStyles.sideHeading}><h2>{copy.quickActions}</h2></div><div className={todayStyles.quickGrid}><Link href="/routes?new=1"><Plus size={17}/><span>{copy.newRoute}</span><ArrowRight size={14}/></Link><Link href="/routes/manage"><RouteIcon size={17}/><span>{copy.reorder}</span><ArrowRight size={14}/></Link><Link href="/contacts"><Users size={17}/><span>{copy.addContact}</span><ArrowRight size={14}/></Link></div></section>
        <section className={todayStyles.sideCard} aria-label={copy.upcoming}><div className={todayStyles.sideHeading}><h2>{copy.upcoming}</h2><Link href="/routes">{copy.viewAll}</Link></div>{loading?<div className={todayStyles.loading}>{t.loading}</div>:todayRoutes.length===0?<p className={todayStyles.emptyText}>{copy.noPending}</p>:<div className={todayStyles.upcomingList}>{todayRoutes.map((route,index)=><Link href="/routes/manage" className={todayStyles.upcomingRow} key={route.id}><span className={todayStyles.order}>{route.position || index+1}</span><span className={todayStyles.routeInfo}><strong>{route.destination_name || t.destination}</strong><span>{routeTypeLabel(route.mission_type)} · {route.driver_id ? copy.assignment : copy.waiting}</span></span><ArrowRight size={16}/></Link>)}</div>}</section>
      </aside>
    </div>
    {hasIssue && <section className={todayStyles.attention} aria-label={copy.attention}><AlertTriangle size={19}/><div><strong>{summary.openIssues} {copy.issue}</strong><p>{copy.review}</p></div><Link href="/reports"><ArrowRight size={16}/></Link></section>}
    <div className={styles.desktopOnly}><TemporaryRouteAssignments /></div>
    <nav className={`nav ${styles.nav}`} aria-label="Primary navigation"><Link href="/manager" aria-current="page"><Home size={17} />{t.home}</Link><Link href="/routes"><RouteIcon size={17} />{t.routes}</Link><Link href="/manager/history"><History size={17} />{t.history}</Link><Link href="/manager/more"><MoreHorizontal size={17} />{t.more}</Link></nav>
  </ManagerShell>
}
