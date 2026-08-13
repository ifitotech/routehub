'use client'

import Link from 'next/link'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {ArrowLeft, CalendarClock, ChevronDown, ClipboardList, History, Home, Image as ImageIcon, MapPin, MoreHorizontal, Navigation, Route as RouteIcon, Ruler, UserRound, X} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import {currentMembership} from '../../../lib/data'
import {useLocale} from '../../../lib/use-preferences'
import styles from './history.module.css'

type HistoryRoute = {
  id: string
  status: 'completed' | 'issue' | 'cancelled'
  driver_id?: string | null
  mission_type?: string | null
  priority?: string | null
  destination_name?: string | null
  destination_address?: string | null
  origin_name?: string | null
  origin_address?: string | null
  order_number?: string | null
  notes?: string | null
  route_date?: string | null
  scheduled_at?: string | null
  created_at?: string | null
  completed_at?: string | null
  completion_method?: string | null
  completion_lat?: number | null
  completion_lng?: number | null
  completion_accuracy?: number | null
  completion_distance_m?: number | null
  completion_warning?: string | null
  completion_photo_path?: string | null
}

type TeamMember = {user_id: string; users?: {email?: string | null} | {email?: string | null}[] | null}

const text = {
  en: {
    operations: 'OPERATIONS', subtitle: 'Completed deliveries, evidence, locations and driver notes.',
    completed: 'Completed', issue: 'Issue reported', cancelled: 'Cancelled', delivery: 'Delivery',
    pickup: 'Pickup', transfer: 'Transfer', return: 'Return to branch', route: 'Route',
    completedAt: 'Completed', recordedAt: 'Recorded', scheduled: 'Scheduled', driver: 'Driver',
    origin: 'Origin', destination: 'Destination', po: 'PO / order', priority: 'Priority',
    completion: 'Completion', location: 'Completion location', accuracy: 'GPS accuracy',
    distance: 'Distance from destination', evidence: 'Delivery evidence', notes: 'Driver notes',
    details: 'View full delivery details', hide: 'Hide full details', openMap: 'Open completion location',
    viewPhoto: 'View delivery photo', hidePhoto: 'Hide photo', loadingPhoto: 'Loading photo…',
    notRecorded: 'Not recorded', noHistory: 'No route history', historyHelp: 'Completed routes and reported issues will appear here.',
    unableLoad: 'Unable to load route history.', unablePhoto: 'Could not load delivery evidence.', branch: 'Main branch',
  },
  es: {
    operations: 'OPERACIONES', subtitle: 'Entregas terminadas, evidencia, ubicaciones y notas del conductor.',
    completed: 'Completada', issue: 'Problema reportado', cancelled: 'Cancelada', delivery: 'Entrega',
    pickup: 'Recogida', transfer: 'Transferencia', return: 'Regreso a sucursal', route: 'Ruta',
    completedAt: 'Completada', recordedAt: 'Registrada', scheduled: 'Programada', driver: 'Conductor',
    origin: 'Origen', destination: 'Destino', po: 'PO / orden', priority: 'Prioridad',
    completion: 'Completada con', location: 'Ubicación de finalización', accuracy: 'Precisión GPS',
    distance: 'Distancia al destino', evidence: 'Evidencia de entrega', notes: 'Notas del conductor',
    details: 'Ver todos los detalles de la entrega', hide: 'Ocultar detalles', openMap: 'Abrir ubicación de finalización',
    viewPhoto: 'Ver foto de la entrega', hidePhoto: 'Ocultar foto', loadingPhoto: 'Cargando foto…',
    notRecorded: 'No registrado', noHistory: 'No hay historial', historyHelp: 'Las rutas completadas e incidencias aparecerán aquí.',
    unableLoad: 'No se pudo cargar el historial.', unablePhoto: 'No se pudo cargar la evidencia de entrega.', branch: 'Sucursal principal',
  },
  fr: {
    operations: 'OPÉRATIONS', subtitle: 'Livraisons terminées, preuves, emplacements et notes du conducteur.',
    completed: 'Terminée', issue: 'Problème signalé', cancelled: 'Annulée', delivery: 'Livraison',
    pickup: 'Collecte', transfer: 'Transfert', return: 'Retour à la succursale', route: 'Itinéraire',
    completedAt: 'Terminée', recordedAt: 'Enregistrée', scheduled: 'Prévue', driver: 'Conducteur',
    origin: 'Origine', destination: 'Destination', po: 'PO / commande', priority: 'Priorité',
    completion: 'Terminée avec', location: 'Lieu de finalisation', accuracy: 'Précision GPS',
    distance: 'Distance jusqu’à la destination', evidence: 'Preuve de livraison', notes: 'Notes du conducteur',
    details: 'Voir tous les détails de la livraison', hide: 'Masquer les détails', openMap: 'Ouvrir le lieu de finalisation',
    viewPhoto: 'Voir la photo de livraison', hidePhoto: 'Masquer la photo', loadingPhoto: 'Chargement de la photo…',
    notRecorded: 'Non enregistré', noHistory: 'Aucun historique', historyHelp: 'Les itinéraires terminés et problèmes apparaîtront ici.',
    unableLoad: 'Impossible de charger l’historique.', unablePhoto: 'Impossible de charger la preuve de livraison.', branch: 'Succursale principale',
  },
} as const

type HistoryCopy = (typeof text)[keyof typeof text]

function emailFor(member?: TeamMember) {
  const user = Array.isArray(member?.users) ? member?.users[0] : member?.users
  return user?.email || ''
}

function friendlyName(email: string) {
  if (!email) return ''
  return email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function typeLabel(type: string | null | undefined, c: HistoryCopy) {
  if (type === 'pickup') return c.pickup
  if (type === 'delivery') return c.delivery
  if (type === 'transfer') return c.transfer
  if (type === 'return') return c.return
  return c.route
}

function statusLabel(status: HistoryRoute['status'], c: HistoryCopy) {
  return status === 'completed' ? c.completed : status === 'issue' ? c.issue : c.cancelled
}

function routeMoment(route: HistoryRoute) {
  return route.completed_at || route.created_at || route.scheduled_at || route.route_date || ''
}

function prettyDate(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString(locale, {dateStyle: 'medium', timeStyle: value.length === 10 ? undefined : 'short'})
}

function coordinates(route: HistoryRoute) {
  return route.completion_lat != null && route.completion_lng != null
    ? `${Number(route.completion_lat).toFixed(6)}, ${Number(route.completion_lng).toFixed(6)}`
    : ''
}

export default function ManagerHistoryPage() {
  const {locale, t} = useLocale()
  const c = text[locale]
  const [routes, setRoutes] = useState<HistoryRoute[]>([])
  const [people, setPeople] = useState<Record<string, TeamMember>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [photoLoading, setPhotoLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const membership = await currentMembership()
      const client = getSupabase()
      const {data, error} = await client
        .from('routes')
        .select('id,status,driver_id,mission_type,priority,destination_name,destination_address,origin_name,origin_address,order_number,notes,route_date,scheduled_at,created_at,completed_at,completion_method,completion_lat,completion_lng,completion_accuracy,completion_distance_m,completion_warning,completion_photo_path')
        .eq('company_id', membership.company_id)
        .in('status', ['completed', 'issue', 'cancelled'])
        .limit(250)
      if (error) throw error
      const history = ((data || []) as HistoryRoute[]).sort((a, b) => new Date(routeMoment(b)).getTime() - new Date(routeMoment(a)).getTime())
      setRoutes(history)
      const ids = [...new Set(history.map(route => route.driver_id).filter((value): value is string => Boolean(value)))]
      if (ids.length) {
        const {data: members, error: memberError} = await client.from('company_users').select('user_id,users(email)').eq('company_id', membership.company_id).in('user_id', ids)
        if (memberError) throw memberError
        setPeople(Object.fromEntries(((members || []) as TeamMember[]).map(member => [member.user_id, member])))
      } else setPeople({})
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.unableLoad)
    } finally {
      setLoading(false)
    }
  }, [c.unableLoad])

  useEffect(() => { void load() }, [load])

  const togglePhoto = async (route: HistoryRoute) => {
    if (!route.completion_photo_path || photoLoading) return
    if (photos[route.id]) {
      setPhotos(current => {
        const next = {...current}
        delete next[route.id]
        return next
      })
      return
    }
    setPhotoLoading(route.id)
    try {
      const {data, error} = await getSupabase().storage.from('route-evidence').createSignedUrl(route.completion_photo_path, 60 * 20)
      if (error) throw error
      setPhotos(current => ({...current, [route.id]: data.signedUrl}))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.unablePhoto)
    } finally {
      setPhotoLoading(null)
    }
  }

  const routeCount = useMemo(() => routes.length, [routes.length])

  return <main className={`app ${styles.page}`}>
    <header className={styles.header}>
      <Link href="/manager" className={styles.back}><ArrowLeft size={18}/>{t.home}</Link>
      <div><span className="eyebrow">{c.operations}</span><h1>{t.history}</h1><p>{c.subtitle}</p>{!loading && <span className={styles.count}>{routeCount} {routeCount === 1 ? c.route : t.routes}</span>}</div>
    </header>
    {message && <p className={styles.message} role="status">{message}</p>}
    {loading ? <section className={styles.list} aria-busy="true" aria-label="Loading history">{[1, 2, 3].map(item => <div key={item} className={styles.skeleton}/>)}</section> : <section className={styles.list}>
      {routes.map(route => {
        const location = coordinates(route)
        const email = route.driver_id ? emailFor(people[route.driver_id]) : ''
        const driver = friendlyName(email)
        const hasDetails = Boolean(route.origin_name || route.origin_address || route.order_number || route.priority || route.scheduled_at || route.completion_method || location || route.completion_distance_m != null || route.completion_accuracy != null || route.completion_warning || route.notes || route.completion_photo_path)
        return <article className={`${styles.route} ${styles[route.status]}`} key={route.id}>
          <div className={styles.routeTop}>
            <span className={styles.icon}><RouteIcon size={18}/></span>
            <div className={styles.copy}><strong>{route.destination_name || route.destination_address || c.destination}</strong><span>{typeLabel(route.mission_type, c)} · {route.origin_address || route.origin_name || c.branch} → {route.destination_address || c.destination}</span></div>
            <span className={styles.status}>{statusLabel(route.status, c)}</span>
          </div>
          <div className={styles.meta}><span><CalendarClock size={14}/>{route.completed_at ? `${c.completedAt}: ${prettyDate(route.completed_at, locale, c.notRecorded)}` : `${c.recordedAt}: ${prettyDate(routeMoment(route), locale, c.notRecorded)}`}</span>{route.completion_method && <span><Navigation size={14}/>{c.completion}: {route.completion_method.toUpperCase()}</span>}</div>
          {hasDetails && <details className={styles.details}>
            <summary><ClipboardList size={16}/><span className={styles.showDetails}>{c.details}</span><span className={styles.hideDetails}>{c.hide}</span><ChevronDown size={17}/></summary>
            <div className={styles.detailGrid}>
              <div><span>{c.driver}</span><strong>{driver || email || c.notRecorded}</strong>{email && driver && <small>{email}</small>}</div>
              <div><span>{c.priority}</span><strong>{route.priority || c.notRecorded}</strong></div>
              <div><span>{c.po}</span><strong>{route.order_number || c.notRecorded}</strong></div>
              <div><span>{c.scheduled}</span><strong>{prettyDate(route.scheduled_at || route.route_date, locale, c.notRecorded)}</strong></div>
              <div className={styles.full}><span>{c.origin}</span><strong>{route.origin_name || route.origin_address || c.branch}</strong><small>{route.origin_address && route.origin_name ? route.origin_address : ''}</small></div>
              <div className={styles.full}><span>{c.destination}</span><strong>{route.destination_name || route.destination_address || c.notRecorded}</strong><small>{route.destination_address && route.destination_name ? route.destination_address : ''}</small></div>
              {location && <div className={styles.full}><span>{c.location}</span><strong>{location}</strong><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noreferrer"><MapPin size={14}/>{c.openMap}</a></div>}
              {route.completion_accuracy != null && <div><span>{c.accuracy}</span><strong>±{Math.round(route.completion_accuracy)} m</strong></div>}
              {route.completion_distance_m != null && <div><span>{c.distance}</span><strong><Ruler size={14}/>{Math.round(route.completion_distance_m)} m</strong></div>}
            </div>
            {route.completion_warning && <p className={styles.warning}>{route.completion_warning}</p>}
            {route.notes && <section className={styles.notes}><span>{c.notes}</span><p>{route.notes}</p></section>}
            {route.completion_photo_path && <div className={styles.evidence}><span>{c.evidence}</span><button type="button" onClick={() => void togglePhoto(route)}><ImageIcon size={16}/>{photoLoading === route.id ? c.loadingPhoto : photos[route.id] ? c.hidePhoto : c.viewPhoto}</button>{photos[route.id] && <div className={styles.photoWrap}><img src={photos[route.id]} alt={`${c.evidence}: ${route.destination_name || route.destination_address || c.route}`}/><button type="button" className={styles.closePhoto} onClick={() => void togglePhoto(route)} aria-label={c.hidePhoto}><X size={16}/></button></div>}</div>}
          </details>}
        </article>
      })}
      {!routes.length && <section className={styles.empty}><RouteIcon size={27}/><h2>{c.noHistory}</h2><p>{c.historyHelp}</p></section>}
    </section>}
    <nav className="nav" aria-label="Manager navigation"><Link href="/manager"><Home size={17}/><span>{t.home}</span></Link><Link href="/routes"><RouteIcon size={17}/><span>{t.routes}</span></Link><Link href="/manager/history" aria-current="page"><History size={17}/><span>{t.history}</span></Link><Link href="/manager/more"><MoreHorizontal size={17}/><span>{t.more}</span></Link></nav>
  </main>
}
