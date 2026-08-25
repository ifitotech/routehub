'use client'

import {Bell, BellRing, Smartphone} from 'lucide-react'
import {useEffect, useState} from 'react'
import {registerPushNotifications} from '../lib/push-notifications'
import {useLocale} from '../lib/use-preferences'

export default function DeviceNotificationsSetting() {
  const {locale} = useLocale()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const copy = locale === 'es'
    ? {title:'Notificaciones del dispositivo', enabled:'Activadas', description:'Recibe avisos de rutas nuevas o cambios, incluso cuando RouteHub está cerrada.', action:'Activar notificaciones', waiting:'Activando…', ios:'En iPhone: abre RouteHub en Safari, toca Compartir → Añadir a pantalla de inicio y abre la app instalada para activarlas.', android:'En Android: abre RouteHub en Chrome y permite las notificaciones.'}
    : {title:'Device notifications', enabled:'Enabled', description:'Receive new-route and route-change alerts even when RouteHub is closed.', action:'Enable notifications', waiting:'Enabling…', ios:'On iPhone: open RouteHub in Safari, tap Share → Add to Home Screen, then open the installed app to enable them.', android:'On Android: open RouteHub in Chrome and allow notifications.'}

  useEffect(() => {
    if (typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) setPermission(Notification.permission)
  }, [])

  const enable = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMessage(isIOS ? copy.ios : copy.android)
      return
    }
    setBusy(true)
    try {
      await registerPushNotifications()
      setPermission('granted')
      setMessage(locale === 'es' ? 'Listo. Este dispositivo recibirá las actualizaciones de rutas aunque la app esté cerrada.' : 'Ready. This device will receive route updates even when the app is closed.')
    } catch (error) {
      setPermission(Notification.permission)
      const detail = error instanceof Error ? error.message : ''
      setMessage(detail.includes('not configured')
        ? (locale === 'es' ? 'Falta configurar la clave pública VAPID en Vercel.' : 'The public VAPID key still needs to be configured in Vercel.')
        : (locale === 'es' ? 'Permite las notificaciones en los ajustes del navegador e inténtalo de nuevo.' : 'Allow notifications in browser settings and try again.'))
    } finally { setBusy(false) }
  }

  const supported = permission !== 'unsupported'
  const enabled = permission === 'granted'
  return <section className="card settings-card notification-settings-card">
    <div className="settings-card-heading"><h2><Bell size={19}/> {copy.title}</h2>{enabled && <span className="notification-settings-status"><BellRing size={15}/>{copy.enabled}</span>}</div>
    <p className="muted">{copy.description}</p>
    {!enabled && <button className="primary" type="button" disabled={busy} onClick={() => void enable()}><Smartphone size={17}/>{busy ? copy.waiting : copy.action}</button>}
    {!supported && <p className="muted notification-settings-help">{typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) ? copy.ios : copy.android}</p>}
    {message && <p className="muted notification-settings-help" role="status">{message}</p>}
  </section>
}
