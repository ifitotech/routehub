'use client'

import Link from 'next/link'
import {Bell, Check, ClipboardList, Mail, Route as RouteIcon, X} from 'lucide-react'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {getSupabase} from '../lib/supabase'
import {registerPushNotifications} from '../lib/push-notifications'
import {useLocale} from '../lib/use-preferences'
import styles from './notification-bell.module.css'

type NotificationType = 'invitation' | 'route' | 'request' | 'activity'
type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  body: string
  createdAt: string
  href: string
  invitationStatus?: string
  canAccept?: boolean
}

const readKey = (userId: string) => `routehub:notifications:read:${userId}`

function loadLocalReadState(userId: string) {
  try {
    const stored = window.localStorage.getItem(readKey(userId))
    return stored ? JSON.parse(stored) as string[] : []
  } catch {
    return []
  }
}

function playNotificationTone(contextRef: {current: AudioContext | null}) {
  try {
    const Context = window.AudioContext || (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext
    if (!Context) return
    const context = contextRef.current || new Context()
    contextRef.current = context
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.setValueAtTime(760, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(520, context.currentTime + .13)
    gain.gain.setValueAtTime(.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(.08, context.currentTime + .01)
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .16)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + .17)
  } catch {
    // Sound is optional: device/browser policy may block it until user interaction.
  }
}

function relativeTime(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return locale === 'es' ? 'Ahora' : locale === 'fr' ? 'A l\u2019instant' : 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return locale === 'es' ? `Hace ${minutes} min` : locale === 'fr' ? `Il y a ${minutes} min` : `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return locale === 'es' ? `Hace ${hours} h` : locale === 'fr' ? `Il y a ${hours} h` : `${hours}h ago`
  const days = Math.round(hours / 24)
  return locale === 'es' ? `Hace ${days} d` : locale === 'fr' ? `Il y a ${days} j` : `${days}d ago`
}

function iconFor(type: NotificationType) {
  if (type === 'invitation') return Mail
  if (type === 'route') return RouteIcon
  if (type === 'request') return ClipboardList
  return Bell
}

export default function NotificationBell() {
  const {locale} = useLocale()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [read, setRead] = useState<string[]>([])
  const [userId, setUserId] = useState('')
  const [acceptingId, setAcceptingId] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [alertPermission, setAlertPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const previousIds = useRef<Set<string> | null>(null)
  const audioContext = useRef<AudioContext | null>(null)

  const copy = useMemo(() => {
    const all = {
      en: {
        label: 'Notifications', title: 'Notifications', empty: 'You’re all caught up.',
        emptyHelp: 'New invitations, routes and requests will appear here.', markRead: 'Mark all as read',
        invitation: 'New team invitation', invitationBody: 'A team invitation is waiting for your account.',
        assignedRoute: 'Route assigned', activeRoute: 'Route updated', routeBody: 'A route assigned to you needs attention.',
        activity: 'New activity', request: 'New request', requestBody: 'A request was added to your company workspace.',
        unread: 'unread', close: 'Close', loading: 'Loading…'
      },
      es: {
        label: 'Notificaciones', title: 'Notificaciones', empty: 'Todo está al día.',
        emptyHelp: 'Aquí aparecerán invitaciones, rutas y solicitudes nuevas.', markRead: 'Marcar todo como leído',
        invitation: 'Nueva invitación del equipo', invitationBody: 'Hay una invitación pendiente para tu cuenta.',
        assignedRoute: 'Ruta asignada', activeRoute: 'Ruta actualizada', routeBody: 'Una ruta asignada necesita tu atención.',
        activity: 'Nueva actividad', request: 'Nueva solicitud', requestBody: 'Se añadió una solicitud al espacio de tu empresa.',
        unread: 'sin leer', close: 'Cerrar', loading: 'Cargando…'
      },
      fr: {
        label: 'Notifications', title: 'Notifications', empty: 'Tout est à jour.',
        emptyHelp: 'Les invitations, itinéraires et demandes apparaîtront ici.', markRead: 'Tout marquer comme lu',
        invitation: 'Nouvelle invitation', invitationBody: 'Une invitation est en attente pour votre compte.',
        assignedRoute: 'Itinéraire attribué', activeRoute: 'Itinéraire mis à jour', routeBody: 'Un itinéraire attribué nécessite votre attention.',
        activity: 'Nouvelle activité', request: 'Nouvelle demande', requestBody: 'Une demande a été ajoutée à votre entreprise.',
        unread: 'non lues', close: 'Fermer', loading: 'Chargement…'
      }
    } as const
    return all[locale]
  }, [locale])

  const invitationCopy = useMemo(() => {
    if (locale === 'es') return {
      accept: 'Aceptar invitaci\u00f3n',
      accepting: 'Aceptando...',
      accepted: 'Invitaci\u00f3n aceptada. Abriendo tu espacio...',
      noPending: 'Esta invitaci\u00f3n ya no est\u00e1 pendiente.',
      error: 'No se pudo aceptar la invitaci\u00f3n. Pide al manager que la reenv\u00ede o ejecuta la migraci\u00f3n de invitaciones en Supabase.'
    }
    if (locale === 'fr') return {
      accept: 'Accepter', accepting: 'Acceptation...', accepted: 'Invitation accept\u00e9e. Ouverture de votre espace...',
      noPending: 'Cette invitation n\u2019est plus en attente.', error: 'Impossible d\u2019accepter l\u2019invitation. Demandez \u00e0 votre manager de la renvoyer ou ex\u00e9cutez la migration Supabase.'
    }
    return {
      accept: 'Accept invitation', accepting: 'Accepting...', accepted: 'Invitation accepted. Opening your workspace...',
      noPending: 'This invitation is no longer pending.', error: 'Could not accept the invitation. Ask a manager to resend it or run the invitation migration in Supabase.'
    }
  }, [locale])

  const load = useCallback(async () => {
    const client = getSupabase()
    const {data: auth} = await client.auth.getUser()
    const user = auth.user
    if (!user) return
    setUserId(user.id)
    const storedRead = loadLocalReadState(user.id)
    setLoading(true)
    try {
      const membershipResult = await client.from('company_users').select('company_id,role').eq('user_id', user.id).limit(1).maybeSingle()
      const membership = membershipResult.data as {company_id?: string; role?: string} | null
      const companyId = membership?.company_id
      const role = membership?.role || ''
      // Supabase query builders are thenable but are not typed as native
      // Promise instances, so keep this small query batch structurally typed.
      const queries: any[] = []

      if (companyId && ['branch_manager', 'operations_manager', 'sales_representative', 'counter_sales'].includes(role)) {
        queries.push(client.from('invitations').select('id,email,role,status,created_at').eq('company_id', companyId).eq('status', 'pending').order('created_at', {ascending: false}).limit(8))
      } else {
        queries.push(Promise.resolve({data: [], error: null}))
      }

      // A claimed invitation is still useful as the driver's first alert. The
      // email filter prevents displaying another member's invitations.
      if (user.email) {
        queries.push(client.from('invitations').select('id,email,role,status,created_at').eq('email', user.email.toLowerCase()).in('status', ['pending', 'accepted']).order('created_at', {ascending: false}).limit(4))
      } else {
        queries.push(Promise.resolve({data: [], error: null}))
      }

      queries.push(client.from('routes').select('id,status,mission_type,destination_name,created_at,updated_version').eq('driver_id', user.id).in('status', ['published', 'active', 'paused']).order('created_at', {ascending: false}).limit(8))

      // Company activity is not a personal notification stream. Route alerts
      // stay scoped to the assigned driver; team invitations are scoped by
      // recipient email above.
      queries.push(Promise.resolve({data: [], error: null}))

      const [invitesResult, ownInvitesResult, routesResult, activityResult] = await Promise.all(queries) as any[]
      const next: NotificationItem[] = []
      for (const invite of (invitesResult?.data || [])) {
        next.push({id: `invitation:${invite.id}`, type: 'invitation', title: copy.invitation, body: `${copy.invitationBody} (${invite.role})`, createdAt: invite.created_at, href: '/manager/invitations', invitationStatus: invite.status})
      }
      for (const invite of (ownInvitesResult?.data || [])) {
        next.push({id: `invitation:${invite.id}`, type: 'invitation', title: copy.invitation, body: `${copy.invitationBody} (${invite.role})`, createdAt: invite.created_at, href: role === 'driver' ? '/driver' : '/manager/invitations', invitationStatus: invite.status, canAccept: invite.status === 'pending'})
      }
      for (const route of (routesResult?.data || [])) {
        const isActive = route.status === 'active' || route.status === 'paused'
        next.push({id: `route:${route.id}:${route.updated_version || route.status}`, type: 'route', title: isActive ? copy.activeRoute : copy.assignedRoute, body: `${String(route.mission_type || 'Delivery').toUpperCase()} · ${route.destination_name || copy.routeBody}`, createdAt: route.created_at, href: '/driver'})
      }
      const actionText: Record<string, {title: string; body: string; type: NotificationType; href: string}> = {
        route_created: {title: copy.assignedRoute, body: copy.routeBody, type: 'route', href: '/routes'},
        mission_updated: {title: copy.activeRoute, body: copy.routeBody, type: 'route', href: '/routes'},
        request_created: {title: copy.request, body: copy.requestBody, type: 'request', href: '/requests'},
        delivery_completed: {title: copy.activity, body: copy.routeBody, type: 'activity', href: '/reports'},
        issue_reported: {title: copy.activity, body: copy.routeBody, type: 'activity', href: '/reports'}
      }
      for (const activity of (activityResult?.data || [])) {
        const mapped = actionText[activity.action]
        if (mapped) next.push({id: `activity:${activity.id}`, ...mapped, createdAt: activity.created_at})
      }
      const unique = Array.from(new Map(next.map(item => [item.id, item])).values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 12)
      setItems(unique)
      const retainedRead = storedRead.filter(id => unique.some(item => item.id === id))
      setRead(retainedRead)
      window.localStorage.setItem(readKey(user.id), JSON.stringify(retainedRead))

      const newest = previousIds.current && unique.find(item => !previousIds.current?.has(item.id))
      previousIds.current = new Set(unique.map(item => item.id))
      if (newest && document.visibilityState !== 'hidden') {
        playNotificationTone(audioContext)
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(newest.title, {body: newest.body, tag: newest.id})
        }
      }
    } catch {
      // Notification access is additive. A denied table/query must not affect the workspace.
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [copy])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 60_000)
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void load()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('routehub:notifications-refresh', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('routehub:notifications-refresh', refresh)
    }
  }, [load])

  useEffect(() => {
    if (typeof Notification !== 'undefined') setAlertPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const unread = items.filter(item => !read.includes(item.id)).length
  const markAllRead = () => {
    const ids = items.map(item => item.id)
    setRead(ids)
    if (userId) window.localStorage.setItem(readKey(userId), JSON.stringify(ids))
  }

  const markRead = (id: string) => {
    if (read.includes(id)) return
    const next = [...read, id]
    setRead(next)
    if (userId) window.localStorage.setItem(readKey(userId), JSON.stringify(next))
  }

  const enableAlerts = async () => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      setActionMessage(locale === 'es'
        ? (isIOS ? 'En iPhone: abre RouteHub en Safari, toca Compartir → Añadir a pantalla de inicio y activa las notificaciones desde la app instalada.' : 'Abre RouteHub en Chrome y permite las notificaciones para este dispositivo.')
        : isIOS ? 'On iPhone: open RouteHub in Safari, tap Share → Add to Home Screen, then enable notifications in the installed app.' : 'Open RouteHub in Chrome and allow notifications for this device.')
      return
    }
    try {
      await registerPushNotifications(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '')
      setAlertPermission('granted')
      playNotificationTone(audioContext)
      setActionMessage(locale === 'es' ? 'Notificaciones del dispositivo activadas. Recibirás cambios de rutas aunque RouteHub esté cerrado.' : 'Device notifications are active. You will receive route updates even when RouteHub is closed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setAlertPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
      if (message.includes('not configured')) {
        setActionMessage(locale === 'es' ? 'Las notificaciones aún no están configuradas en este entorno. Agrega NEXT_PUBLIC_VAPID_PUBLIC_KEY en Vercel.' : 'Notifications are not configured in this environment yet. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY in Vercel.')
      } else {
        setActionMessage(locale === 'es' ? 'Permite las notificaciones en los ajustes del navegador para activarlas.' : 'Allow notifications in browser settings to enable them.')
      }
    }
  }

  const acceptInvitation = async (item: NotificationItem) => {
    if (!item.canAccept || acceptingId) return
    setAcceptingId(item.id)
    setActionMessage('')
    try {
      const invitationId = item.id.replace('invitation:', '')
      const {data, error} = await getSupabase().rpc('claim_team_invitation', {target_invitation_id: invitationId})
      if (error) throw error
      if (!Array.isArray(data) || data.length === 0) {
        markRead(item.id)
        setActionMessage(invitationCopy.noPending)
        await load()
        return
      }
      markRead(item.id)
      setActionMessage(invitationCopy.accepted)
      window.dispatchEvent(new Event('routehub:notifications-refresh'))
      window.setTimeout(() => window.location.assign(item.href), 500)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('Unable to accept RouteHub invitation', {invitationId: item.id, error})
      setActionMessage(process.env.NODE_ENV === 'development' ? `${invitationCopy.error} (${detail})` : invitationCopy.error)
    } finally {
      setAcceptingId('')
    }
  }

  return <div className={`notification-bell ${styles.root}`}>
    <button className="notification-bell__button" type="button" aria-label={`${copy.label}${unread ? `, ${unread} ${copy.unread}` : ''}`} aria-expanded={open} aria-controls="routehub-notifications" onPointerDown={event => event.stopPropagation()} onClick={() => { setOpen(value => !value); if (!open) void load() }}>
      <Bell size={20} strokeWidth={2.2} aria-hidden="true" />
      {unread > 0 && <span className="notification-bell__count" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="notification-bell__panel" id="routehub-notifications" role="dialog" aria-label={copy.title} onPointerDown={event => event.stopPropagation()}>
      <div className="notification-bell__heading"><div><strong>{copy.title}</strong><span>{unread ? `${unread} ${copy.unread}` : copy.empty}</span></div><button type="button" className="notification-bell__close" onClick={() => setOpen(false)} aria-label={copy.close}><X size={17}/></button></div>
      {loading ? <div className="notification-bell__empty">{copy.loading}</div> : items.length ? <div className="notification-bell__list">{items.map(item => {
        const Icon = iconFor(item.type)
        const isRead = read.includes(item.id)
        const content = <>
          <span className={`notification-bell__icon notification-bell__icon--${item.type}`}><Icon size={17}/></span>
          <span className="notification-bell__copy"><strong>{item.title}</strong><span>{item.body}</span><small>{relativeTime(item.createdAt, locale)}</small>{item.canAccept && <button className="notification-bell__accept" type="button" disabled={acceptingId === item.id} onClick={() => void acceptInvitation(item)}>{acceptingId === item.id ? invitationCopy.accepting : invitationCopy.accept}</button>}</span>
          {!isRead && <i aria-hidden="true" />}
        </>
        if (item.canAccept) return <div className={`notification-bell__item${isRead ? ' is-read' : ''}`} key={item.id}>{content}</div>
        return <Link className={`notification-bell__item${isRead ? ' is-read' : ''}`} href={item.href} key={item.id} onClick={() => { markRead(item.id); setOpen(false) }}>{content}</Link>
      })}</div> : <div className="notification-bell__empty"><Check size={22}/><strong>{copy.empty}</strong><span>{copy.emptyHelp}</span></div>}
      {alertPermission !== 'granted' && <button className="notification-bell__alerts" type="button" onClick={() => void enableAlerts()}>{locale === 'es' ? 'Activar notificaciones del dispositivo' : locale === 'fr' ? 'Activer les notifications de l’appareil' : 'Enable device notifications'}</button>}
      {actionMessage && <p className="notification-bell__feedback" role="status">{actionMessage}</p>}
      {items.length > 0 && unread > 0 && <button className="notification-bell__mark" type="button" onClick={markAllRead}>{copy.markRead}</button>}
    </div>}
  </div>
}
