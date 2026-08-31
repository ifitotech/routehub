'use client'

import Link from 'next/link'
import {useEffect, useMemo, useState} from 'react'
import {AlertTriangle, ArrowRight, History, Home, MoreHorizontal, Plus, Route as RouteIcon, Users} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {currentMembership} from '../../lib/data'
import {loadManagerDashboard, managerOperationalDate, type DashboardRoute, type DashboardSummary} from '../../lib/dashboard'
import {useLocale} from '../../lib/use-preferences'
import dynamic from 'next/dynamic'
import TemporaryRouteAssignments from '../temporary-route-assignments'
import ManagerShell from './manager-shell'
import styles from './manager-dashboard.module.css'
import todayStyles from './manager-today.module.css'

const OperationsMap = dynamic(() => import('../operations-map'), {ssr: false, loading: () => <div className={todayStyles.opsMap} aria-hidden />})

const emptySummary: DashboardSummary = {activeRoutes: 0, pendingRoutes: 0, completedRoutes: 0, openIssues: 0}

type LiveFix = {driverId: string; updatedAt: string | null; lat: number | null; lng: number | null}

export default function Manager() {
  const {locale,t} = useLocale()
  const copy = locale === 'es' ? {
    today: 'Hoy', todayOverview: 'Operación de hoy', liveOperations: 'En curso', active: 'Activas', pending: 'Pendientes', completed: 'Completadas', issues: 'Incidencias',
    liveDescription: 'Parada que el Driver está ejecutando ahora.', quickActions: 'Acciones',
    upcoming: 'Rutas pendientes', attention: 'Atención necesaria', viewAll: 'Ver todas', viewRoute: 'Ver ruta', viewMap: 'Ver en mapa',
    newRoute: 'Nueva ruta', reorder: 'Reordenar rutas', addContact: 'Agregar contacto', noPending: 'No hay rutas hoy.',
    assignment: 'Asignado', waiting: 'Sin asignar', issue: 'incidencia abierta', review: 'Revisa los reportes de ruta.',
    branchManager: 'Manager de sucursal', currentBranch: 'Sucursal actual', updated: 'Actualizado',
    lastSeen: 'Última ubicación', noFix: 'El Driver no está compartiendo ubicación (app cerrada).', ago: 'hace', seeMore: 'Ver más',
  } : locale === 'fr' ? {
    today: 'Aujourd’hui', todayOverview: 'Opérations du jour', liveOperations: 'En cours', active: 'Actifs', pending: 'En attente', completed: 'Terminés', issues: 'Incidents',
    liveDescription: 'Arrêt en cours chez le chauffeur.', quickActions: 'Actions',
    upcoming: 'Itinéraires en attente', attention: 'Attention requise', viewAll: 'Voir tout', viewRoute: 'Voir l’itinéraire', viewMap: 'Voir sur la carte',
    newRoute: 'Nouvel itinéraire', reorder: 'Réordonner', addContact: 'Ajouter un contact', noPending: 'Aucun itinéraire aujourd’hui.',
    assignment: 'Assigné', waiting: 'Non assigné', issue: 'incident ouvert', review: 'Consultez les rapports.',
    branchManager: 'Manager de succursale', currentBranch: 'Succursale actuelle', updated: 'Mis à jour',
    lastSeen: 'Dernière position', noFix: 'Le chauffeur ne partage pas sa position (app fermée).', ago: 'il y a', seeMore: 'Voir plus',
  } : {
    today: 'Today', todayOverview: 'Today’s operations', liveOperations: 'In progress', active: 'Active', pending: 'Pending', completed: 'Completed', issues: 'Issues',
    liveDescription: 'The stop the driver is running now.', quickActions: 'Actions',
    upcoming: 'Pending routes', attention: 'Attention needed', viewAll: 'View all', viewRoute: 'View route', viewMap: 'View on map',
    newRoute: 'New route', reorder: 'Reorder routes', addContact: 'Add contact', noPending: 'No routes today.',
    assignment: 'Assigned', waiting: 'Unassigned', issue: 'open issue', review: 'Review route reports.',
    branchManager: 'Branch Manager', currentBranch: 'Current branch', updated: 'Updated',
    lastSeen: 'Last location', noFix: 'Driver is not sharing location (app closed).', ago: 'ago', seeMore: 'See more',
  }
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary)
  const [todayRoutes, setTodayRoutes] = useState<DashboardRoute[]>([])
  const [companyId, setCompanyId] = useState('')
  const [dashboardBranchId, setDashboardBranchId] = useState<string | null>(null)
  const [branchName, setBranchName] = useState('')
  const [branchOrigin, setBranchOrigin] = useState<{address: string; lat: number | null; lng: number | null}>({address: '', lat: null, lng: null})
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [liveFix, setLiveFix] = useState<LiveFix | null>(null)
  const [mapSummary, setMapSummary] = useState<{count:number;distanceMeters?:number;durationSeconds?:number} | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const membership = await currentMembership()
        const client = getSupabase()
        const branchQuery = membership.branch_id
          ? client.from('branches').select('id,name,address,latitude,longitude').eq('id', membership.branch_id).maybeSingle()
          : client.from('branches').select('id,name,address,latitude,longitude').eq('company_id', membership.company_id).order('name').limit(1).maybeSingle()
        const [{data: userData, error: userError}, {data: branch, error: branchError}] = await Promise.all([
          client.auth.getUser(),
          branchQuery,
        ])
        if (userError || branchError) throw userError || branchError
        const branchId = String(branch?.id || membership.branch_id || '') || null
        setCompanyId(membership.company_id)
        setDashboardBranchId(branchId)
        const dashboard = await loadManagerDashboard({
          companyId: membership.company_id,
          branchId,
          routeDate: managerOperationalDate(),
        })
        let sessionQuery = client.from('driving_sessions')
          .select('driver_id,last_lat,last_lng,last_updated_at,status')
          .eq('company_id', membership.company_id)
          .in('status', ['active', 'paused'])
          .order('last_updated_at', {ascending: false})
          .limit(8)
        if (branchId) sessionQuery = sessionQuery.eq('branch_id', branchId)
        const {data: sessions} = await sessionQuery
        if (cancelled) return
        const metadata = userData.user?.user_metadata as Record<string, unknown> | undefined
        const name = String(metadata?.full_name || metadata?.name || userData.user?.email || '')
        setDisplayName(name)
        setBranchName(String(branch?.name || ''))
        setBranchOrigin({
          address: String(branch?.address || branch?.name || ''),
          lat: branch?.latitude == null ? null : Number(branch.latitude),
          lng: branch?.longitude == null ? null : Number(branch.longitude),
        })
        setTodayRoutes(dashboard.todayRoutes.slice().sort((a, b) => Number(a.position || 0) - Number(b.position || 0)))
        setSummary(dashboard.summary)
        const session = (sessions || []).find(row => row.last_lat != null && row.last_lng != null) || sessions?.[0] || null
        setLiveFix(session ? {
          driverId: String(session.driver_id || ''),
          updatedAt: session.last_updated_at || null,
          lat: session.last_lat == null ? null : Number(session.last_lat),
          lng: session.last_lng == null ? null : Number(session.last_lng),
        } : null)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t.unableLoadReports)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [t.unableLoadReports])

  useEffect(() => {
    if (!companyId) return
    const client = getSupabase()
    const channel = client
      .channel(`manager-driver-location-${companyId}-${dashboardBranchId || 'all'}`)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'driving_sessions', filter: `company_id=eq.${companyId}`}, payload => {
        const row = payload.new as Partial<{driver_id:string;branch_id:string|null;status:string;last_lat:number|null;last_lng:number|null;last_updated_at:string|null}>
        if (!row.driver_id || (dashboardBranchId && row.branch_id && row.branch_id !== dashboardBranchId)) return
        if (!['active', 'paused'].includes(String(row.status || '')) || row.last_lat == null || row.last_lng == null) {
          setLiveFix(current => current?.driverId === row.driver_id ? null : current)
          return
        }
        setLiveFix({
          driverId: row.driver_id,
          updatedAt: row.last_updated_at || new Date().toISOString(),
          lat: Number(row.last_lat),
          lng: Number(row.last_lng),
        })
      })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [companyId, dashboardBranchId])

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
  const routeTypeLabel = (value?: string | null) => {
    const v = String(value || '').toLowerCase()
    if (v === 'pickup') return t.pickup
    if (v === 'delivery') return t.delivery
    if (v === 'return' || v === 'branch') return t.returnToBranch
    return value || t.route
  }
  const statusLabel = (value?: string | null) => {
    const v = String(value || '')
    if (v === 'completed') return copy.completed
    if (v === 'active' || v === 'paused') return copy.active
    if (v === 'issue') return copy.issues
    if (v === 'published' || v === 'pending' || v === 'draft') return copy.pending
    return v
  }
  const fixLabel = useMemo(() => {
    if (!liveFix?.updatedAt || liveFix.lat == null) return copy.noFix
    const ms = Date.now() - new Date(liveFix.updatedAt).getTime()
    if (!Number.isFinite(ms) || ms < 0) return copy.lastSeen
    const minutes = Math.floor(ms / 60000)
    if (minutes < 1) return `${copy.lastSeen} · ${locale === 'es' ? 'ahora' : locale === 'fr' ? 'maintenant' : 'now'}`
    return `${copy.lastSeen} · ${copy.ago} ${minutes}m`
  }, [liveFix, copy.lastSeen, copy.noFix, copy.ago, locale])

  return <ManagerShell active="today" branchName={branchName || t.mainBranch} displayName={greetingName || 'Manager'} roleLabel={copy.branchManager}>
    <section className={styles.intro}><div><p className={todayStyles.headerDate}>{dateLabel}</p><h1>{copy.today}</h1><p>{branchName || t.mainBranch}</p></div><div className={styles.introMeta}><span>{copy.updated}: {new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit'}).format(new Date())}</span><span className={styles.desktopGreeting}>{greetingName || 'Manager'}</span></div></section>
    {error && <p className={styles.error} role="status">{error}</p>}
    <section className={todayStyles.summary} aria-label={t.branchMetrics}>{metrics.map(({label,value,href,tone}) => <Link className={`${todayStyles.summaryCard} ${tone}`} href={href} key={label} aria-label={`${label}: ${value}`}><strong>{loading ? '—' : value}</strong><span>{label}</span></Link>)}</section>
    <div className={todayStyles.todayLayout}>
      <main className={todayStyles.todayMain}>
        <div className={todayStyles.sectionHeading}><div><span>{copy.liveOperations}</span><h2>{copy.liveDescription}</h2></div><Link href="/routes/live">{copy.viewMap}</Link></div>
        <p className={todayStyles.fixLine}>{fixLabel}</p>
        <div className={todayStyles.opsMap}>
          <OperationsMap
            hideFooter
            onSummary={setMapSummary}
            routes={todayRoutes.filter(route => String(route.status || '') !== 'cancelled').map(route => ({
              id: route.id,
              mission_type: route.mission_type,
              origin_address: route.origin_address || branchOrigin.address,
              origin_lat: route.origin_lat ?? branchOrigin.lat,
              origin_lng: route.origin_lng ?? branchOrigin.lng,
              destination_name: route.destination_name,
              destination_address: route.destination_address,
              destination_lat: route.destination_lat,
              destination_lng: route.destination_lng,
              status: route.status,
              driver_id: route.driver_id,
              position: route.position,
              order_number: route.order_number,
            }))}
            driverLocations={liveFix?.lat != null && liveFix.lng != null ? [{
              id: liveFix.driverId || 'driver',
              driver_id: liveFix.driverId,
              location: {lat: liveFix.lat, lng: liveFix.lng},
              updatedAt: liveFix.updatedAt,
              status: 'on_route',
              nextStop: todayRoutes.find(route => route.driver_id === liveFix.driverId && ['active', 'paused'].includes(String(route.status || '')))?.destination_name
                || todayRoutes.find(route => ['active', 'paused'].includes(String(route.status || '')))?.destination_name
                || undefined,
            }] : []}
            locale={locale}
          />
        </div>
        <p className={todayStyles.mapStrip}>
          {(() => {
            const open = todayRoutes.filter(route => !['completed', 'cancelled'].includes(String(route.status || ''))).length
            const count = mapSummary?.count ?? open
            const base = locale === 'es' ? `${count} rutas abiertas` : locale === 'fr' ? `${count} itinéraires ouverts` : `${count} open routes`
            if (!mapSummary?.durationSeconds || !mapSummary?.distanceMeters) return base
            const minutes = Math.max(1, Math.round(mapSummary.durationSeconds / 60))
            const miles = Math.max(1, Math.round(mapSummary.distanceMeters / 1609.34))
            return `${base} · ${minutes} min · ${miles} mi`
          })()}
        </p>
      </main>
      <aside className={todayStyles.todaySide}>
        <section className={todayStyles.sideCard} aria-label={copy.upcoming}>
          <div className={todayStyles.sideHeading}><h2>{copy.upcoming}</h2><Link href="/routes">{copy.viewAll}</Link></div>
          {loading ? <div className={todayStyles.loading}>{t.loading}</div> : (() => {
            const pending = todayRoutes
              .filter(route => !['completed', 'cancelled'].includes(String(route.status || '')))
              .slice()
              .sort((a, b) => {
                const rank = (status?: string | null) => status === 'active' || status === 'paused' ? 0 : status === 'issue' ? 2 : 1
                return rank(a.status) - rank(b.status) || Number(a.position || 0) - Number(b.position || 0)
              })
            const extra = pending.length > 6
            const row = (route: DashboardRoute, index: number) => {
              const po = route.order_number && !['return', 'branch'].includes(String(route.mission_type || '').toLowerCase()) ? `PO ${route.order_number}` : ''
              return (
                <Link href="/routes/manage" className={todayStyles.dayRow} data-status={route.status} key={route.id}>
                  <span className={todayStyles.order}>{index + 1}</span>
                  <span className={todayStyles.routeInfo}>
                    <strong>{route.destination_name || t.destination}</strong>
                    <span>{routeTypeLabel(route.mission_type)}{po ? ` · ${po}` : ''}</span>
                  </span>
                  <em className={todayStyles.status}>{statusLabel(route.status)}</em>
                </Link>
              )
            }
            if (!pending.length) return <p className={todayStyles.emptyText}>{copy.noPending}</p>
            return (
              <>
                <div className={todayStyles.dayList}>{pending.slice(0, 6).map((route, index) => row(route, index))}</div>
                {extra ? <Link className={todayStyles.seeMore} href="/routes">{copy.seeMore}</Link> : null}
              </>
            )
          })()}
        </section>
      </aside>
    </div>
    {hasIssue && <section className={todayStyles.attention} aria-label={copy.attention}><AlertTriangle size={19}/><div><strong>{summary.openIssues} {copy.issue}</strong><p>{copy.review}</p></div><Link href="/reports"><ArrowRight size={16}/></Link></section>}
    <div className={`${styles.desktopOnly} ${todayStyles.hideOnFit}`}><TemporaryRouteAssignments /></div>
    <nav className={`nav ${styles.nav} ${styles.todayNav}`} aria-label="Primary navigation"><Link href="/manager" aria-current="page"><Home size={17} />{t.home}</Link><Link href="/routes"><RouteIcon size={17} />{t.routes}</Link><Link href="/manager/history"><History size={17} />{t.history}</Link><Link href="/manager/more"><MoreHorizontal size={17} />{t.more}</Link></nav>
  </ManagerShell>
}
