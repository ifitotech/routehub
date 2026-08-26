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

const emptySummary: DashboardSummary = {activeRoutes: 0, pendingRoutes: 0, completedRoutes: 0, openIssues: 0}

export default function Manager() {
  const {locale,t} = useLocale()
  const copy = locale === 'es' ? {
    activeRoutes: 'Rutas activas', pendingRoutes: 'Rutas pendientes', completedRoutes: 'Rutas completadas',
    todayOverview: 'Resumen de hoy', lastUpdated: 'Última actualización', liveOperations: 'Operaciones en vivo',
    driversMoving: 'Conductores y rutas en movimiento.', openLiveMap: 'Abrir mapa en vivo', noActiveDrivers: 'No hay conductores activos',
    noActiveDriversHelp: 'Cuando un conductor inicie su jornada o una ruta, su estado en vivo aparecerá aquí.', viewTeam: 'Ver equipo',
    commonTasks: 'Tareas frecuentes del manager.', newRoute: 'Nueva ruta', newRouteHelp: 'Crea una recogida o entrega',
    teamMembers: 'Miembros del equipo', teamMembersHelp: 'Gestiona conductores e invitaciones', viewHistory: 'Ver historial',
    viewHistoryHelp: 'Revisa el trabajo completado', routeActivity: 'Rutas pendientes', routeActivityHelp: 'Rutas publicadas y programadas que esperan despacho.',
    viewAll: 'Ver todo', attentionNeeded: 'Atención necesaria', attentionHelp: 'Problemas que requieren revisión del manager.', viewIssues: 'Ver incidencias',
    noIssues: 'No hay incidencias reportadas', noIssuesHelp: 'Tu equipo no tiene incidencias de ruta para revisar hoy.', openIssue: 'incidencia abierta', openIssues: 'incidencias abiertas',
    reviewIssues: 'Revisa los reportes de ruta y da seguimiento al conductor.', branchManager: 'Manager de sucursal', today: 'Hoy', map: 'Mapa', contacts: 'Contactos', settings: 'Configuración',
  } : locale === 'fr' ? {
    activeRoutes: 'Itinéraires actifs', pendingRoutes: 'Itinéraires en attente', completedRoutes: 'Itinéraires terminés',
    todayOverview: 'Aperçu du jour', lastUpdated: 'Dernière mise à jour', liveOperations: 'Opérations en direct',
    driversMoving: 'Conducteurs et itinéraires actuellement en mouvement.', openLiveMap: 'Ouvrir la carte en direct', noActiveDrivers: 'Aucun conducteur actif',
    noActiveDriversHelp: 'Lorsqu’un conducteur commence sa journée ou un itinéraire, son statut en direct apparaît ici.', viewTeam: 'Voir l’équipe',
    commonTasks: 'Tâches courantes du manager.', newRoute: 'Nouvel itinéraire', newRouteHelp: 'Créer une collecte ou une livraison',
    teamMembers: 'Membres de l’équipe', teamMembersHelp: 'Gérer les conducteurs et les invitations', viewHistory: 'Voir l’historique',
    viewHistoryHelp: 'Consulter le travail terminé', routeActivity: 'Itinéraires en attente', routeActivityHelp: 'Itinéraires publiés et programmés en attente d’envoi.',
    viewAll: 'Voir tout', attentionNeeded: 'Attention requise', attentionHelp: 'Problèmes nécessitant la révision du manager.', viewIssues: 'Voir les incidents',
    noIssues: 'Aucun incident signalé', noIssuesHelp: 'Votre équipe n’a aucun incident à examiner aujourd’hui.', openIssue: 'incident ouvert', openIssues: 'incidents ouverts',
    reviewIssues: 'Consultez les rapports et assurez le suivi avec le conducteur.', branchManager: 'Manager de succursale', today: 'Aujourd’hui', map: 'Carte', contacts: 'Contacts', settings: 'Paramètres',
  } : {
    activeRoutes: 'Active routes', pendingRoutes: 'Pending routes', completedRoutes: 'Completed routes',
    todayOverview: 'Today Overview', lastUpdated: 'Last updated', liveOperations: 'Live operations',
    driversMoving: 'Drivers and routes currently moving.', openLiveMap: 'Open live map', noActiveDrivers: 'No active drivers',
    noActiveDriversHelp: 'When a driver starts their day or route, their live status will appear here.', viewTeam: 'View team',
    commonTasks: 'Common manager tasks.', newRoute: 'New route', newRouteHelp: 'Create a pickup or delivery',
    teamMembers: 'Team members', teamMembersHelp: 'Manage drivers and invitations', viewHistory: 'View history',
    viewHistoryHelp: 'Review completed work', routeActivity: 'Pending routes', routeActivityHelp: 'Published and scheduled routes waiting for dispatch.',
    viewAll: 'View all', attentionNeeded: 'Attention needed', attentionHelp: 'Problems that need manager review.', viewIssues: 'View issues',
    noIssues: 'No issues reported', noIssuesHelp: 'Your team has no route issues to review today.', openIssue: 'open issue', openIssues: 'open issues',
    reviewIssues: 'Review route reports and follow up with the driver.', branchManager: 'Branch Manager', today: 'Today', map: 'Map', contacts: 'Contacts', settings: 'Settings',
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
    {label: copy.activeRoutes, value: summary.activeRoutes, note: t.inProgress, href: '/routes', Icon: Truck, tone: 'blue'},
    {label: copy.pendingRoutes, value: summary.pendingRoutes, note: t.waitingDispatch, href: '/routes', Icon: ClipboardList, tone: 'amber'},
    {label: copy.completedRoutes, value: summary.completedRoutes, note: t.completed, href: '/manager/history', Icon: History, tone: 'purple'},
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
        <Link href="/manager" aria-current="page"><Home size={20}/><span>{copy.today}</span></Link>
        <Link href="/routes"><RouteIcon size={20}/><span>{t.routes}</span></Link>
        <Link href="/routes/live"><MapPin size={20}/><span>{copy.map}</span></Link>
        <Link href="/contacts"><Users size={20}/><span>{copy.contacts}</span></Link>
        <Link href="/manager/history"><History size={20}/><span>{t.history}</span></Link>
        <Link href="/manager/more"><MoreHorizontal size={20}/><span>{copy.settings}</span></Link>
      </nav>
      <Link href="/routes?new=1" className={styles.newRoute}><Plus size={20}/>{copy.newRoute}</Link>
      <Link href="/manager/more" className={styles.sidebarProfile}><span className={styles.sidebarAvatar}>{greetingName.slice(0, 2).toUpperCase()}</span><span><strong>{greetingName || 'Manager'}</strong><small>{copy.branchManager}</small></span><ChevronDown size={16}/></Link>
    </aside>

    <section className={styles.workspace}>
    <header className={styles.desktopTop}>
      <h1>{copy.todayOverview}</h1>
      <span>{copy.lastUpdated}: {updatedAt}</span>
    </header>
    <header className={styles.header}>
      <Link href="/manager" className={styles.brand} aria-label="RouteHub home">
        <Image src="/routehub-regular-new.jpg" alt="" width={40} height={40} priority />
        <span>Route<em>Hub</em></span>
      </Link>
      <NotificationBell />
    </header>

    <section className={styles.intro}>
      <h1>{t.helloPrefix} {greetingName}</h1>
      <p>{copy.today} · {branchName || t.mainBranch}</p>
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

    <section className={styles.mobileLiveCard} aria-label={copy.liveOperations}>
      <div className={styles.mobileLiveTop}><span className={styles.mobileLiveIcon}><Truck size={20} /></span><div><span className={styles.mobileLiveEyebrow}>{copy.liveOperations.toUpperCase()}</span><h2>{locale==='es'?'Operaciones de un vistazo':locale==='fr'?'Opérations en un coup d’œil':'Operations at a glance'}</h2></div><span className={styles.liveStatus}><i />Live</span></div>
      <div className={styles.mobileLiveStats}><span><strong>{loading ? '—' : summary.activeRoutes}</strong> {copy.activeRoutes.toLowerCase()}</span><span><strong>{loading ? '—' : summary.pendingRoutes}</strong> {copy.pendingRoutes.toLowerCase()}</span></div>
      {summary.activeRoutes>0?<Link className={styles.mobileLiveCta} href="/routes/live"><MapPin size={18} />{copy.openLiveMap}<ChevronRight size={18} /></Link>:<div className={styles.mobileLiveCta}><Users size={18} />{copy.noActiveDrivers}</div>}
    </section>

    <section className={styles.desktopOperations} aria-label={copy.liveOperations}>
      <div className={styles.desktopLivePanel}>
        <div className={styles.desktopPanelHeader}><span><h2>{copy.liveOperations}</h2><p>{copy.driversMoving}</p></span><Link href="/routes/live">{copy.openLiveMap}</Link></div>
        <LiveRoute companyId={companyId} branchId={dashboardBranchId} showToday={false} overview/>
      </div>
      <aside className={styles.desktopQuickPanel} aria-label={t.quickActions}>
        <div className={styles.desktopPanelHeader}><span><h2>{t.quickActions}</h2><p>{copy.commonTasks}</p></span></div>
        <div className={styles.desktopQuickList}>
          <Link className={styles.action} href="/routes?new=1"><span className={styles.actionIcon}><Plus size={21} aria-hidden="true" /></span><span className={styles.actionCopy}><strong>{copy.newRoute}</strong><span>{copy.newRouteHelp}</span></span><ChevronRight size={18} aria-hidden="true" /></Link>
          <Link className={styles.action} href="/manager/team"><span className={styles.actionIcon}><Users size={20} aria-hidden="true" /></span><span className={styles.actionCopy}><strong>{copy.teamMembers}</strong><span>{copy.teamMembersHelp}</span></span><ChevronRight size={18} aria-hidden="true" /></Link>
          <Link className={styles.action} href="/manager/history"><span className={styles.actionIcon}><History size={20} aria-hidden="true" /></span><span className={styles.actionCopy}><strong>{copy.viewHistory}</strong><span>{copy.viewHistoryHelp}</span></span><ChevronRight size={18} aria-hidden="true" /></Link>
        </div>
      </aside>
    </section>

    <section className={styles.desktopTracking}>
      <div className={styles.desktopRoutesPanel}>
        <div className={styles.desktopPanelHeader}><span><h2>{copy.routeActivity}</h2><p>{copy.routeActivityHelp}</p></span><Link href="/routes">{copy.viewAll}</Link></div>
        <section className={`${styles.todayCard} ${hasIssue ? styles.attention : ''}`} aria-live="polite">
          {loading ? <div className={styles.skeleton} aria-label={t.loading} /> : todayRoutes.length ? <div className={styles.todayList}>{todayRoutes.map(route => <div className={styles.todayRow} key={route.id}><span className={styles.todayBadge} /><span className={styles.todayBody}><strong>{route.destination_name || t.destination}</strong><span>{String(route.mission_type || t.delivery).toUpperCase()} · {route.driver_id ? t.assigned : t.pending}</span></span><span className={styles.todayState}>{route.status || t.published}</span></div>)}</div> : <div className={styles.empty}><span className={styles.emptyIcon}><ClipboardList size={27} aria-hidden="true" /></span><div><h2>{t.noRoutesToday}</h2><p>{t.createRouteWhenReady}</p><Link className={styles.emptyCta} href="/routes?new=1">{t.createRoute}</Link></div></div>}
        </section>
      </div>
      <div className={`${styles.desktopAttentionPanel} ${hasIssue ? styles.attention : ''}`}>
        <div className={styles.desktopPanelHeader}><span><h2>{copy.attentionNeeded}</h2><p>{copy.attentionHelp}</p></span><Link href="/reports">{copy.viewIssues}</Link></div>
        <div className={styles.attentionBody}><span className={styles.attentionIcon}><AlertTriangle size={22} /></span><div><strong>{summary.openIssues ? `${summary.openIssues} ${summary.openIssues === 1 ? copy.openIssue : copy.openIssues}` : copy.noIssues}</strong><p>{summary.openIssues ? copy.reviewIssues : copy.noIssuesHelp}</p></div></div>
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
