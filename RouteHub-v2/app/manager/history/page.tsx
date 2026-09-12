'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {AlertTriangle, BarChart3, CalendarDays, Camera, CheckCircle2, ChevronDown, Clock3, Download, FileText, Image as ImageIcon, MapPin, Navigation, Printer, Ruler, Search, Signature, TriangleAlert, UserRound, X, XCircle} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import {currentMembership} from '../../../lib/data'
import {useLocale} from '../../../lib/use-preferences'
import ManagerShell from '../manager-shell'
import styles from './history.module.css'

type HistoryRoute = {
  id: string
  status: 'completed' | 'issue' | 'cancelled'
  driver_id?: string | null
  mission_type?: string | null
  priority?: string | null
  destination_name?: string | null
  destination_address?: string | null
  destination_phone?: string | null
  origin_name?: string | null
  origin_address?: string | null
  order_number?: string | null
  notes?: string | null
  driver_note?: string | null
  route_date?: string | null
  scheduled_at?: string | null
  created_at?: string | null
  completed_at?: string | null
  route_started_at?: string | null
  route_completed_at?: string | null
  arrived_at?: string | null
  completion_method?: string | null
  completion_lat?: number | null
  completion_lng?: number | null
  completion_accuracy?: number | null
  completion_distance_m?: number | null
  completion_warning?: string | null
  completion_photo_path?: string | null
  customer_signature_path?: string | null
  finalized_at?: string | null
  finalization_method?: string | null
  finalization_note?: string | null
  finalization_issue?: string | null
  finalization_photo_path?: string | null
}

type TeamMember = {user_id: string; users?: {email?: string | null} | {email?: string | null}[] | null}
type Activity = {id: string; action: string; created_at: string; user_id: string; record_id?: string | null}
type Period = 'today' | '7d' | '30d' | 'all' | 'custom'
type Tab = 'overview' | 'log'

const copy = {
  en: {operations: 'OPERATIONS', title: 'Reports & History', subtitle: 'Operational metrics, proof and what happened at every stop.', manager: 'Branch Manager', back: 'Today', overviewTab: 'Overview', logTab: 'Route log', filters: 'Filters', today: 'Today', sevenDays: '7 days', thirtyDays: '30 days', all: 'All', custom: 'Custom date', from: 'From', to: 'To', search: 'Search route, contact, address, PO or driver', status: 'Status', allStatuses: 'All statuses', completed: 'Completed', issue: 'Issue', cancelled: 'Cancelled', type: 'Type', allTypes: 'All types', pickup: 'Pickup', delivery: 'Delivery', return: 'Return to branch', transfer: 'Transfer', driver: 'Driver', allDrivers: 'All drivers', clear: 'Clear', routes: 'routes', completedCount: 'completed', issueCount: 'issues', route: 'Route', recorded: 'Recorded', completedAt: 'Completed', duration: 'Duration', noHistory: 'No history found', historyHelp: 'Completed routes, cancellations and reported issues will appear here.', unableLoad: 'Unable to load route history.', unableEvidence: 'Could not load evidence.', notRecorded: 'Not recorded', details: 'View details', hide: 'Hide details', overview: 'Overview', workDetails: 'Work details', proof: 'Proof of delivery', issues: 'Issues', location: 'Location', destination: 'Destination', origin: 'Origin', order: 'PO / order number', priority: 'Priority', scheduled: 'Scheduled', started: 'Started', arrived: 'Arrived', completionMethod: 'Completion method', openLocation: 'Open location', accuracy: 'GPS accuracy', distance: 'Distance at completion', notes: 'Notes', driverNotes: 'Driver notes', viewPhoto: 'View photo', hidePhoto: 'Hide photo', viewSignature: 'View signature', hideSignature: 'Hide signature', loading: 'Loading…', photo: 'Photo', signature: 'Signature', finalizationPhoto: 'Finalization photo', pod: 'POD available', phone: 'Phone', warning: 'Completion warning', issueDetails: 'Issue details', finalizationNote: 'Finalization note', arrivedLabel: 'Arrived', total: 'Total routes', avgDuration: 'Average route duration', breakdown: 'Operation breakdown', deliveries: 'Deliveries', pickups: 'Pickups', returns: 'Returns', completion: 'Completion status', activity: 'Recent activity', export: 'Export activity CSV', print: 'Print / PDF', noRoutes: 'No routes in this period.', noActivity: 'No activity yet', activityHelp: 'Route activity will appear here.', teamMember: 'Team member', loadingReports: 'Loading reports…'},
  es: {operations: 'OPERACIONES', title: 'Reportes e historial', subtitle: 'Métricas operativas, evidencia y lo que ocurrió en cada parada.', manager: 'Manager de sucursal', back: 'Hoy', overviewTab: 'Resumen', logTab: 'Historial de rutas', filters: 'Filtros', today: 'Hoy', sevenDays: '7 días', thirtyDays: '30 días', all: 'Todo', custom: 'Fecha personalizada', from: 'Desde', to: 'Hasta', search: 'Buscar ruta, contacto, dirección, PO o conductor', status: 'Estado', allStatuses: 'Todos los estados', completed: 'Completada', issue: 'Incidencia', cancelled: 'Cancelada', type: 'Tipo', allTypes: 'Todos los tipos', pickup: 'Recogida', delivery: 'Entrega', return: 'Regreso a sucursal', transfer: 'Transferencia', driver: 'Conductor', allDrivers: 'Todos los conductores', clear: 'Limpiar', routes: 'rutas', completedCount: 'completadas', issueCount: 'incidencias', route: 'Ruta', recorded: 'Registrada', completedAt: 'Completada', duration: 'Duración', noHistory: 'No se encontró historial', historyHelp: 'Las rutas completadas, canceladas e incidencias aparecerán aquí.', unableLoad: 'No se pudo cargar el historial.', unableEvidence: 'No se pudo cargar la evidencia.', notRecorded: 'No registrado', details: 'Ver detalles', hide: 'Ocultar detalles', overview: 'Resumen', workDetails: 'Detalles del trabajo', proof: 'Prueba de entrega', issues: 'Incidencias', location: 'Ubicación', destination: 'Destino', origin: 'Origen', order: 'Número de PO / orden', priority: 'Prioridad', scheduled: 'Programada', started: 'Iniciada', arrived: 'Llegada', completionMethod: 'Método de finalización', openLocation: 'Abrir ubicación', accuracy: 'Precisión GPS', distance: 'Distancia al completar', notes: 'Notas', driverNotes: 'Notas del conductor', viewPhoto: 'Ver foto', hidePhoto: 'Ocultar foto', viewSignature: 'Ver firma', hideSignature: 'Ocultar firma', loading: 'Cargando…', photo: 'Foto', signature: 'Firma', finalizationPhoto: 'Foto de finalización', pod: 'POD disponible', phone: 'Teléfono', warning: 'Advertencia de finalización', issueDetails: 'Detalles de la incidencia', finalizationNote: 'Nota de finalización', arrivedLabel: 'Llegada', total: 'Rutas totales', avgDuration: 'Duración promedio de ruta', breakdown: 'Desglose operativo', deliveries: 'Entregas', pickups: 'Recogidas', returns: 'Regresos', completion: 'Estado de finalización', activity: 'Actividad reciente', export: 'Exportar actividad CSV', print: 'Imprimir / PDF', noRoutes: 'No hay rutas en este periodo.', noActivity: 'Aún no hay actividad', activityHelp: 'La actividad de rutas aparecerá aquí.', teamMember: 'Miembro del equipo', loadingReports: 'Cargando reportes…'},
  fr: {operations: 'OPÉRATIONS', title: 'Rapports et historique', subtitle: 'Indicateurs opérationnels, preuves et événements de chaque arrêt.', manager: 'Manager de succursale', back: "Aujourd’hui", overviewTab: 'Résumé', logTab: 'Historique des itinéraires', filters: 'Filtres', today: "Aujourd’hui", sevenDays: '7 jours', thirtyDays: '30 jours', all: 'Tout', custom: 'Date personnalisée', from: 'Du', to: 'Au', search: 'Rechercher itinéraire, contact, adresse, PO ou conducteur', status: 'Statut', allStatuses: 'Tous les statuts', completed: 'Terminée', issue: 'Incident', cancelled: 'Annulée', type: 'Type', allTypes: 'Tous les types', pickup: 'Collecte', delivery: 'Livraison', return: 'Retour à la succursale', transfer: 'Transfert', driver: 'Conducteur', allDrivers: 'Tous les conducteurs', clear: 'Effacer', routes: 'itinéraires', completedCount: 'terminés', issueCount: 'incidents', route: 'Itinéraire', recorded: 'Enregistrée', completedAt: 'Terminée', duration: 'Durée', noHistory: 'Aucun historique trouvé', historyHelp: 'Les itinéraires terminés, annulés et incidents apparaîtront ici.', unableLoad: "Impossible de charger l’historique.", unableEvidence: 'Impossible de charger la preuve.', notRecorded: 'Non enregistré', details: 'Voir les détails', hide: 'Masquer les détails', overview: 'Résumé', workDetails: 'Détails du travail', proof: 'Preuve de livraison', issues: 'Incidents', location: 'Emplacement', destination: 'Destination', origin: 'Origine', order: 'Numéro PO / commande', priority: 'Priorité', scheduled: 'Prévue', started: 'Démarrée', arrived: 'Arrivée', completionMethod: 'Méthode de finalisation', openLocation: 'Ouvrir l’emplacement', accuracy: 'Précision GPS', distance: 'Distance à la finalisation', notes: 'Notes', driverNotes: 'Notes du conducteur', viewPhoto: 'Voir la photo', hidePhoto: 'Masquer la photo', viewSignature: 'Voir la signature', hideSignature: 'Masquer la signature', loading: 'Chargement…', photo: 'Photo', signature: 'Signature', finalizationPhoto: 'Photo de finalisation', pod: 'POD disponible', phone: 'Téléphone', warning: 'Avertissement', issueDetails: 'Détails de l’incident', finalizationNote: 'Note de finalisation', arrivedLabel: 'Arrivée', total: 'Itinéraires totaux', avgDuration: 'Durée moyenne', breakdown: 'Répartition opérationnelle', deliveries: 'Livraisons', pickups: 'Collectes', returns: 'Retours', completion: 'Statut de finalisation', activity: 'Activité récente', export: 'Exporter l’activité CSV', print: 'Imprimer / PDF', noRoutes: 'Aucun itinéraire pour cette période.', noActivity: 'Aucune activité', activityHelp: 'L’activité apparaîtra ici.', teamMember: 'Membre de l’équipe', loadingReports: 'Chargement des rapports…'},
} as const

type Copy = (typeof copy)[keyof typeof copy]

const actionNames: Record<string, string> = {route_created: 'Route created', route_updated: 'Route updated', route_started: 'Route started', route_paused: 'Route paused', routes_reordered: 'Routes reordered', delivery_completed: 'Delivery completed'}

function emailFor(member?: TeamMember) { const user = Array.isArray(member?.users) ? member?.users[0] : member?.users; return user?.email || '' }
function friendlyName(email: string) { return email ? email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '' }
function typeKey(type: string | null | undefined) { return type === 'pickup' || type === 'delivery' || type === 'return' || type === 'transfer' ? type : '' }
function typeLabel(type: string | null | undefined, c: Copy) { if (type === 'pickup') return c.pickup; if (type === 'delivery') return c.delivery; if (type === 'transfer') return c.transfer; if (type === 'return') return c.return; return c.route }
function routeMoment(route: HistoryRoute) { return route.route_completed_at || route.completed_at || route.finalized_at || route.created_at || route.scheduled_at || route.route_date || '' }
function parseDate(value: string | null | undefined) { if (!value) return null; const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? null : date }
function prettyDate(value: string | null | undefined, locale: string, fallback: string) { const date = parseDate(value); return date ? date.toLocaleString(locale, {dateStyle: 'medium', timeStyle: value?.length === 10 ? undefined : 'short'}) : fallback }
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function durationLabel(route: HistoryRoute) { const start = parseDate(route.route_started_at)?.getTime(); const end = parseDate(route.route_completed_at)?.getTime(); if (start == null || end == null || end < start) return ''; const minutes = Math.max(0, Math.round((end - start) / 60000)); if (minutes < 60) return `${minutes} min`; const hours = Math.floor(minutes / 60); const rest = minutes % 60; return rest ? `${hours}h ${rest}min` : `${hours}h` }
function minutesLabel(minutes: number) { return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ''}` }
function coordinates(route: HistoryRoute) { return route.completion_lat != null && route.completion_lng != null ? `${Number(route.completion_lat).toFixed(6)}, ${Number(route.completion_lng).toFixed(6)}` : '' }
function statusLabel(route: HistoryRoute, c: Copy) { return route.status === 'completed' ? c.completed : route.status === 'issue' ? c.issue : c.cancelled }

export default function ManagerHistoryPage() {
  const {locale} = useLocale(); const c = copy[locale]
  // Arriving from a "view details" link on a completed route elsewhere
  // (dispatch board) passes ?q=<destination> - land already searched for
  // it instead of an unfiltered list the driver/date filters would hide it
  // behind, since "all time" isn't the default period. A link from Settings
  // or the old /reports URL can also request the Overview tab directly.
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const focusId = searchParams.get('id') || ''
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'overview' ? 'overview' : 'log')
  const [routes, setRoutes] = useState<HistoryRoute[]>([]); const [activity, setActivity] = useState<Activity[]>([]); const [people, setPeople] = useState<Record<string, TeamMember>>({}); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>(initialQuery ? 'all' : '30d'); const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState(''); const [search, setSearch] = useState(initialQuery); const [status, setStatus] = useState(''); const [kind, setKind] = useState(''); const [driverId, setDriverId] = useState('')
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({}); const [evidenceLoading, setEvidenceLoading] = useState<string | null>(null)

  // One load for both tabs - Reports and History used to run two almost
  // identical queries against the same routes table for the same period/
  // driver filters. activity_logs (the system audit trail Reports' feed
  // reads) is the one truly separate dataset, fetched alongside it.
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const membership = await currentMembership()
      const client = getSupabase()
      const [{data, error}, {data: activityData, error: activityError}] = await Promise.all([
        client.from('routes').select('id,status,driver_id,mission_type,priority,destination_name,destination_address,destination_phone,origin_name,origin_address,order_number,notes,driver_note,route_date,scheduled_at,created_at,completed_at,route_started_at,route_completed_at,arrived_at,completion_method,completion_lat,completion_lng,completion_accuracy,completion_distance_m,completion_warning,completion_photo_path,customer_signature_path,finalized_at,finalization_method,finalization_note,finalization_issue,finalization_photo_path').eq('company_id', membership.company_id).in('status', ['completed', 'issue', 'cancelled']).limit(500),
        client.from('activity_logs').select('id,action,created_at,user_id,record_id').eq('company_id', membership.company_id).order('created_at', {ascending: false}).limit(200),
      ])
      if (error) throw error
      if (activityError) throw activityError
      const rows = ((data || []) as HistoryRoute[]).sort((a, b) => (parseDate(routeMoment(b))?.getTime() || 0) - (parseDate(routeMoment(a))?.getTime() || 0))
      setRoutes(rows)
      setActivity((activityData || []) as Activity[])
      const ids = [...new Set(rows.map(route => route.driver_id).filter((value): value is string => Boolean(value)))]
      if (ids.length) {
        const {data: members, error: memberError} = await client.from('company_users').select('user_id,users(email)').eq('company_id', membership.company_id).in('user_id', ids)
        if (memberError) throw memberError
        setPeople(Object.fromEntries(((members || []) as TeamMember[]).map(member => [member.user_id, member])))
      } else setPeople({})
      setMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : c.unableLoad) } finally { setLoading(false) }
  }, [c.unableLoad])
  useEffect(() => { void load() }, [load])

  const driverOptions = useMemo(() => Object.entries(people).map(([id, member]) => ({id, name: friendlyName(emailFor(member)), email: emailFor(member)})).sort((a, b) => a.name.localeCompare(b.name)), [people])
  // Shared by both tabs - filtering by status/type on the log also narrows
  // the Overview KPIs to match, instead of the two views silently
  // disagreeing about what "this period" contains.
  const filteredRoutes = useMemo(() => { const now = new Date(); const today = localDateKey(now); const start = new Date(now); start.setHours(0, 0, 0, 0); if (period === '7d') start.setDate(start.getDate() - 6); if (period === '30d') start.setDate(start.getDate() - 29); const query = search.trim().toLowerCase(); return routes.filter(route => { const moment = parseDate(routeMoment(route)); const dateKey = moment ? localDateKey(moment) : ''; if (period === 'today' && dateKey !== today) return false; if ((period === '7d' || period === '30d') && (!moment || moment < start)) return false; if (period === 'custom' && ((fromDate && dateKey < fromDate) || (toDate && dateKey > toDate))) return false; if (status && route.status !== status) return false; if (kind && typeKey(route.mission_type) !== kind) return false; if (driverId && route.driver_id !== driverId) return false; if (query) { const email = route.driver_id ? emailFor(people[route.driver_id]) : ''; const haystack = [route.destination_name, route.destination_address, route.origin_name, route.origin_address, route.order_number, route.notes, email].filter(Boolean).join(' ').toLowerCase(); if (!haystack.includes(query)) return false } return true }) }, [driverId, fromDate, kind, people, period, routes, search, status, toDate])
  const completedCount = filteredRoutes.filter(route => route.status === 'completed').length; const issueCount = filteredRoutes.filter(route => route.status === 'issue').length; const cancelledCount = filteredRoutes.filter(route => route.status === 'cancelled').length
  const durationValues = filteredRoutes.map(route => { const start = parseDate(route.route_started_at)?.getTime(); const end = parseDate(route.route_completed_at)?.getTime(); return start != null && end != null && end >= start ? Math.round((end - start) / 60000) : null }).filter((value): value is number => value != null)
  const averageDuration = durationValues.length ? Math.round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length) : null
  const breakdown = [{key: 'delivery', label: c.deliveries}, {key: 'pickup', label: c.pickups}, {key: 'return', label: c.returns}].map(item => ({...item, count: filteredRoutes.filter(route => typeKey(route.mission_type) === item.key).length}))
  const maxBreakdown = Math.max(1, ...breakdown.map(item => item.count))

  const toggleEvidence = async (route: HistoryRoute, kindName: 'photo' | 'signature' | 'finalization') => { const path = kindName === 'photo' ? route.completion_photo_path : kindName === 'signature' ? route.customer_signature_path : route.finalization_photo_path; if (!path || evidenceLoading) return; const key = `${route.id}:${kindName}`; if (evidenceUrls[key]) { setEvidenceUrls(current => { const next = {...current}; delete next[key]; return next }); return } setEvidenceLoading(key); try { const {data, error} = await getSupabase().storage.from('route-evidence').createSignedUrl(path, 60 * 20); if (error) throw error; setEvidenceUrls(current => ({...current, [key]: data.signedUrl})) } catch (error) { setMessage(error instanceof Error ? error.message : c.unableEvidence) } finally { setEvidenceLoading(null) } }
  const clearFilters = () => { setPeriod('30d'); setFromDate(''); setToDate(''); setSearch(''); setStatus(''); setKind(''); setDriverId('') }
  const exportCsv = () => { const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`; const content = [['Action', c.teamMember, 'Created at', 'Record'], ...activity.map(row => [actionNames[row.action] || row.action.replaceAll('_', ' '), friendlyName(emailFor(people[row.user_id])) || c.teamMember, row.created_at, row.record_id || ''])].map(row => row.map(csvCell).join(',')).join('\n'); const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([content], {type: 'text/csv'})); anchor.download = 'routehub-activity.csv'; anchor.click() }

  return <ManagerShell active="history" roleLabel={c.manager}><div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.headerCopy}><span className={styles.eyebrow}>{c.operations}</span><h1>{c.title}</h1><p>{c.subtitle}</p></div>
      {tab === 'overview' ? <div className={styles.headerActions}><Link href="/manager" className={styles.back}>{c.back}</Link><button type="button" onClick={() => window.print()}><Printer size={16}/>{c.print}</button><button type="button" onClick={exportCsv}><Download size={16}/>CSV</button></div> : <Link href="/manager" className={styles.back}>{c.back}</Link>}
    </header>

    <div className={styles.tabs} role="tablist">
      <button type="button" role="tab" aria-selected={tab === 'overview'} className={tab === 'overview' ? styles.tabActive : ''} onClick={() => setTab('overview')}>{c.overviewTab}</button>
      <button type="button" role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? styles.tabActive : ''} onClick={() => setTab('log')}>{c.logTab}</button>
    </div>

    <section className={styles.filters} aria-label={c.filters}>
      <div className={styles.periods}>{(['today', '7d', '30d', 'all', 'custom'] as Period[]).map(value => <button type="button" key={value} className={period === value ? styles.periodActive : ''} onClick={() => setPeriod(value)}>{value === 'today' ? c.today : value === '7d' ? c.sevenDays : value === '30d' ? c.thirtyDays : value === 'all' ? c.all : c.custom}</button>)}</div>
      {tab === 'log' && <label className={styles.search}><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder={c.search} aria-label={c.search}/></label>}
      <div className={styles.selects}>
        {tab === 'log' && <label><span>{c.status}</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="">{c.allStatuses}</option><option value="completed">{c.completed}</option><option value="issue">{c.issue}</option><option value="cancelled">{c.cancelled}</option></select></label>}
        {tab === 'log' && <label><span>{c.type}</span><select value={kind} onChange={event => setKind(event.target.value)}><option value="">{c.allTypes}</option><option value="pickup">{c.pickup}</option><option value="delivery">{c.delivery}</option><option value="return">{c.return}</option><option value="transfer">{c.transfer}</option></select></label>}
        {driverOptions.length > 0 && <label><span>{c.driver}</span><select value={driverId} onChange={event => setDriverId(event.target.value)}><option value="">{c.allDrivers}</option>{driverOptions.map(driver => <option value={driver.id} key={driver.id}>{driver.name || driver.email}</option>)}</select></label>}
      </div>
      {period === 'custom' && <div className={styles.dateFields}><label><span>{c.from}</span><input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)}/></label><label><span>{c.to}</span><input type="date" value={toDate} onChange={event => setToDate(event.target.value)}/></label></div>}
      <button type="button" className={styles.clear} onClick={clearFilters}>{c.clear}</button>
    </section>

    {message && <p className={styles.message} role="status">{message}</p>}

    {tab === 'overview' ? (
      loading ? <div className={styles.loading}>{c.loadingReports}</div> : <>
        <section className={styles.kpis}>
          <Kpi icon={<BarChart3/>} label={c.total} value={filteredRoutes.length}/>
          <Kpi icon={<CheckCircle2/>} label={c.completed} value={completedCount} tone="success"/>
          <Kpi icon={<TriangleAlert/>} label={c.issues} value={issueCount} tone="warning"/>
          <Kpi icon={<Clock3/>} label={c.avgDuration} value={averageDuration == null ? '—' : minutesLabel(averageDuration)} tone="neutral"/>
        </section>
        <div className={styles.columns}>
          <section className={styles.card}>
            <div className={styles.sectionHeading}><h2>{c.breakdown}</h2></div>
            {breakdown.map(item => <div className={styles.breakdown} key={item.key}><div><span>{item.label}</span><strong>{item.count}</strong></div><div className={styles.bar}><i style={{width: `${(item.count / maxBreakdown) * 100}%`}}/></div></div>)}
          </section>
          <section className={styles.card}>
            <div className={styles.sectionHeading}><h2>{c.completion}</h2></div>
            <div className={styles.statusList}>
              <StatusRow icon={<CheckCircle2/>} label={c.completed} value={completedCount} tone="success"/>
              <StatusRow icon={<TriangleAlert/>} label={c.issues} value={issueCount} tone="warning"/>
              <StatusRow icon={<XCircle/>} label={c.cancelled} value={cancelledCount} tone="neutral"/>
            </div>
          </section>
        </div>
        <section className={styles.card}>
          <div className={styles.sectionHeading}><h2>{c.activity}</h2><span>{activity.length} {activity.length === 1 ? c.route : c.routes}</span></div>
          {activity.slice(0, 8).map(row => <div className={styles.activityRow} key={row.id}><FileText size={17}/><div><strong>{actionNames[row.action] || row.action.replaceAll('_', ' ')}</strong><span>{new Date(row.created_at).toLocaleString(locale)} · {friendlyName(emailFor(people[row.user_id])) || c.teamMember}</span></div></div>)}
          {!activity.length && <p className={styles.emptyText}>{c.noActivity} — {c.activityHelp}</p>}
        </section>
        {!filteredRoutes.length && <p className={styles.emptyText}>{c.noRoutes}</p>}
      </>
    ) : (
      <>
        {!loading && <p className={styles.summary}><strong>{filteredRoutes.length}</strong> {c.routes}<span>·</span><strong>{completedCount}</strong> {c.completedCount}<span>·</span><strong>{issueCount}</strong> {c.issueCount}</p>}
        {loading ? <section className={styles.list} aria-busy="true" aria-label={c.loading}>{[1, 2, 3].map(item => <div key={item} className={styles.skeleton}/>)}</section> : <section className={styles.list}>{filteredRoutes.map(route => <HistoryRow key={route.id} route={route} people={people} c={c} locale={locale} evidenceUrls={evidenceUrls} evidenceLoading={evidenceLoading} onToggleEvidence={toggleEvidence} defaultOpen={route.id === focusId}/>)}{!filteredRoutes.length && <section className={styles.empty}><Clock3 size={28}/><h2>{c.noHistory}</h2><p>{c.historyHelp}</p></section>}</section>}
      </>
    )}
  </div></ManagerShell>
}

function Kpi({icon, label, value, tone = 'blue'}: {icon: React.ReactNode; label: string; value: string | number; tone?: string}) { return <article className={`${styles.kpi} ${styles[`kpi_${tone}`]}`}><span>{icon}</span><strong>{value}</strong><small>{label}</small></article> }
function StatusRow({icon, label, value, tone}: {icon: React.ReactNode; label: string; value: number; tone: string}) { return <div className={styles.statusRow}><span className={styles[`status_${tone}`]}>{icon}</span><b>{label}</b><strong>{value}</strong></div> }

function HistoryRow({route, people, c, locale, evidenceUrls, evidenceLoading, onToggleEvidence, defaultOpen}: {route: HistoryRoute; people: Record<string, TeamMember>; c: Copy; locale: string; evidenceUrls: Record<string, string>; evidenceLoading: string | null; onToggleEvidence: (route: HistoryRoute, kind: 'photo' | 'signature' | 'finalization') => Promise<void>; defaultOpen?: boolean}) {
  const email = route.driver_id ? emailFor(people[route.driver_id]) : ''; const driver = friendlyName(email); const location = coordinates(route); const hasEvidence = Boolean(route.completion_photo_path || route.customer_signature_path || route.finalization_photo_path); const hasIssue = route.status === 'issue' || Boolean(route.finalization_issue || route.completion_warning); const duration = durationLabel(route); const destination = route.destination_name || route.destination_address || c.destination
  // Arriving via a "view details" link elsewhere already names this exact
  // route - open its details and scroll to it immediately instead of
  // landing on the filtered list and requiring a second click to expand it.
  const rowRef = useRef<HTMLElement>(null)
  useEffect(() => { if (defaultOpen) rowRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'}) }, [defaultOpen])
  return <article ref={rowRef} className={`${styles.route} ${styles[`route_${route.status}`]}`}><div className={styles.routeMain}><div className={styles.routeDate}><CalendarDays size={16}/><span>{prettyDate(route.route_date || routeMoment(route), locale, c.notRecorded)}</span></div><div className={styles.routeIdentity}><span className={styles.routeType}>{typeLabel(route.mission_type, c)}</span><h2>{destination}</h2><p>{route.destination_address || route.origin_address || ''}</p></div><div className={styles.routeDriver}><UserRound size={16}/><span>{driver || email || c.notRecorded}</span></div><div className={styles.routeStatus}><span className={styles.status}>{statusLabel(route, c)}</span>{hasEvidence && <span className={styles.evidenceBadge}><CheckCircle2 size={14}/>{c.pod}</span>}{hasIssue && <span className={styles.issueBadge}><AlertTriangle size={14}/>{c.issue}</span>}</div><div className={styles.routeTiming}><span>{route.completed_at || route.route_completed_at ? `${c.completedAt}: ${prettyDate(route.route_completed_at || route.completed_at, locale, c.notRecorded)}` : `${c.recorded}: ${prettyDate(routeMoment(route), locale, c.notRecorded)}`}</span>{duration && <strong><Clock3 size={15}/>{duration}</strong>}</div></div><details className={styles.details} open={defaultOpen}><summary><FileText size={16}/><span className={styles.showDetails}>{c.details}</span><span className={styles.hideDetails}>{c.hide}</span><ChevronDown size={17}/></summary><div className={styles.detailSections}><section><h3>{c.overview}</h3><div className={styles.detailGrid}><Detail label={c.type} value={typeLabel(route.mission_type, c)}/><Detail label={c.driver} value={driver || email || c.notRecorded} extra={email && driver ? email : undefined}/><Detail label={c.started} value={prettyDate(route.route_started_at, locale, c.notRecorded)}/><Detail label={c.completedAt} value={prettyDate(route.route_completed_at || route.completed_at || route.finalized_at, locale, c.notRecorded)}/>{duration && <Detail label={c.duration} value={duration}/>} {route.completion_method && <Detail label={c.completionMethod} value={route.completion_method}/>}</div></section>{(route.origin_name || route.origin_address || route.destination_name || route.destination_address || route.order_number || route.priority || route.notes || route.driver_note || route.destination_phone) && <section><h3>{c.workDetails}</h3><div className={styles.detailGrid}>{(route.origin_name || route.origin_address) && <Detail label={c.origin} value={route.origin_name || route.origin_address} extra={route.origin_name && route.origin_address ? route.origin_address : undefined}/>} {(route.destination_name || route.destination_address) && <Detail label={c.destination} value={route.destination_name || route.destination_address} extra={route.destination_name && route.destination_address ? route.destination_address : undefined}/>} {route.destination_phone && <Detail label={c.phone} value={route.destination_phone}/>} {route.order_number && <Detail label={c.order} value={route.order_number}/>} {route.priority && <Detail label={c.priority} value={route.priority}/>} {route.scheduled_at && <Detail label={c.scheduled} value={prettyDate(route.scheduled_at, locale, c.notRecorded)}/>} {route.notes && <Detail label={c.notes} value={route.notes} full/>} {route.driver_note && <Detail label={c.driverNotes} value={route.driver_note} full/>}</div></section>}{hasEvidence && <section><h3>{c.proof}</h3><div className={styles.evidenceActions}>{route.completion_photo_path && <EvidenceButton icon={<Camera size={16}/>} label={evidenceLoading === `${route.id}:photo` ? c.loading : evidenceUrls[`${route.id}:photo`] ? c.hidePhoto : c.viewPhoto} onClick={() => void onToggleEvidence(route, 'photo')}/>} {route.customer_signature_path && <EvidenceButton icon={<Signature size={16}/>} label={evidenceLoading === `${route.id}:signature` ? c.loading : evidenceUrls[`${route.id}:signature`] ? c.hideSignature : c.viewSignature} onClick={() => void onToggleEvidence(route, 'signature')}/>} {route.finalization_photo_path && <EvidenceButton icon={<ImageIcon size={16}/>} label={evidenceLoading === `${route.id}:finalization` ? c.loading : c.finalizationPhoto} onClick={() => void onToggleEvidence(route, 'finalization')}/>}</div><EvidencePreview route={route} kind="photo" url={evidenceUrls[`${route.id}:photo`]} onToggle={onToggleEvidence} label={c.photo}/><EvidencePreview route={route} kind="signature" url={evidenceUrls[`${route.id}:signature`]} onToggle={onToggleEvidence} label={c.signature}/><EvidencePreview route={route} kind="finalization" url={evidenceUrls[`${route.id}:finalization`]} onToggle={onToggleEvidence} label={c.photo}/></section>}{(hasIssue || route.finalization_note) && <section className={styles.issueSection}><h3><AlertTriangle size={16}/>{c.issues}</h3>{route.finalization_issue && <p><strong>{c.issueDetails}:</strong> {route.finalization_issue}</p>}{route.completion_warning && <p><strong>{c.warning}:</strong> {route.completion_warning}</p>}{route.finalization_note && <p><strong>{c.finalizationNote}:</strong> {route.finalization_note}</p>}</section>}{(location || route.completion_accuracy != null || route.completion_distance_m != null || route.arrived_at) && <section><h3><MapPin size={16}/>{c.location}</h3><div className={styles.detailGrid}>{route.arrived_at && <Detail label={c.arrivedLabel} value={prettyDate(route.arrived_at, locale, c.notRecorded)}/>} {location && <div className={styles.full}><span>{c.location}</span><strong>{location}</strong><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noreferrer"><Navigation size={14}/>{c.openLocation}</a></div>} {route.completion_accuracy != null && <Detail label={c.accuracy} value={`±${Math.round(route.completion_accuracy)} m`}/>} {route.completion_distance_m != null && <Detail label={c.distance} value={`${Math.round(route.completion_distance_m)} m`} icon={<Ruler size={14}/>}/>}</div></section>}</div></details></article>
}

function Detail({label, value, extra, full, icon}: {label: string; value?: string | null; extra?: string | null; full?: boolean; icon?: React.ReactNode}) { return <div className={full ? styles.full : undefined}><span>{label}</span><strong>{icon}{value || ''}</strong>{extra && <small>{extra}</small>}</div> }
function EvidenceButton({icon, label, onClick}: {icon: React.ReactNode; label: string; onClick: () => void}) { return <button type="button" onClick={onClick}>{icon}{label}</button> }
function EvidencePreview({route, kind, url, onToggle, label}: {route: HistoryRoute; kind: 'photo' | 'signature' | 'finalization'; url?: string; onToggle: (route: HistoryRoute, kind: 'photo' | 'signature' | 'finalization') => Promise<void>; label: string}) { if (!url) return null; return <div className={styles.evidencePreview}><img src={url} alt={kind === 'signature' ? 'Signature' : label}/><button type="button" onClick={() => void onToggle(route, kind)} aria-label="Close"><X size={16}/></button></div> }
