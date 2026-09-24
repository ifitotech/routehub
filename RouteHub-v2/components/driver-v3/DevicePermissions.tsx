'use client'

import {useCallback, useEffect, useState} from 'react'
import styles from '../../app/driver-v3/driver-preferences.module.css'
import {registerPushNotifications} from '../../lib/push-notifications'
import {Capacitor, deviceAccess, type DeviceAccessStatus} from '../../lib/device-access'
import {getCurrentLocation, getLocationPermission, type LocationPermission} from '../../lib/location'

type Access = DeviceAccessStatus
type NotificationState = 'granted' | 'denied' | 'prompt' | 'unavailable'

export default function DevicePermissions({locale}: {locale: string}) {
  const [android, setAndroid] = useState(false)
  const [native, setNative] = useState(false)
  const [access, setAccess] = useState<Access | null>(null)
  const [location, setLocation] = useState<LocationPermission>('prompt')
  const [notifications, setNotifications] = useState<NotificationState>('prompt')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const es = locale === 'es'
  const fr = locale === 'fr'

  const refresh = useCallback(async () => {
    const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
    setNative(Capacitor.isNativePlatform())
    setAndroid(isAndroid)
    if (isAndroid) {
      try {
        const [{PushNotifications}, status] = await Promise.all([
          import('@capacitor/push-notifications'), deviceAccess.status(),
        ])
        const push = await PushNotifications.checkPermissions()
        setNotifications(push.receive === 'granted' ? 'granted' : push.receive === 'denied' ? 'denied' : 'prompt')
        setAccess(status)
        setLocation(status.location === 'granted' ? 'granted' : status.location === 'denied' ? 'denied' : 'prompt')
      } catch {
        setError(es ? 'No se pudieron leer los permisos del dispositivo.' : 'Could not read device permissions.')
      }
      return
    }
    const [locationPermission] = await Promise.all([getLocationPermission()])
    setLocation(locationPermission)
    const notificationPermission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unavailable'
    setNotifications(notificationPermission === 'default' ? 'prompt' : notificationPermission)
  }, [es])

  useEffect(() => {
    void refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [refresh])

  const requestLocation = async () => {
    setBusy(true)
    setError('')
    try {
      if (android) setAccess(await deviceAccess.request({permission: 'location'}))
      else await getCurrentLocation({maximumAge: 0}) // permission check only; do not upload this fix
      await refresh()
    } catch {
      setError(es ? 'No se pudo permitir la ubicación. Si ya la rechazaste, cámbiala en los ajustes del dispositivo.' : 'Location was not allowed. If previously denied, change it in device settings.')
      await refresh()
    } finally { setBusy(false) }
  }

  const requestNotifications = async () => {
    setBusy(true)
    setError('')
    try { await registerPushNotifications(); await refresh() }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : (es ? 'No se pudieron activar las notificaciones.' : 'Notifications could not be enabled.'))
      await refresh()
    } finally { setBusy(false) }
  }

  const allowed = (value: string) => value === 'granted'
    ? (es ? 'Permitido' : fr ? 'Autorisé' : 'Allowed')
    : value === 'denied'
      ? (es ? 'Rechazado; revisa Ajustes' : fr ? 'Refusé; vérifiez les réglages' : 'Denied; check Settings')
      : value === 'unsupported'
        ? (es ? 'No disponible' : fr ? 'Indisponible' : 'Unavailable')
        : (es ? 'Aún no permitido' : fr ? 'Pas encore autorisé' : 'Not allowed yet')

  return <section className={styles.section}>
    <div className={styles.sectionHeader}><h2>{android ? (es ? 'Permisos de Android' : 'Android permissions') : (es ? 'Permisos del dispositivo' : fr ? 'Autorisations de l’appareil' : 'Device permissions')}</h2>
      <p>{es ? 'La ubicación solo se comparte mientras una ruta activa se navega dentro de RouteHub. Esta pantalla puede solicitar permisos, pero no envía tu ubicación.' : fr ? 'La position est partagée uniquement pendant un itinéraire actif dans la navigation RouteHub. Cet écran peut demander des autorisations, mais n’envoie pas votre position.' : 'Location is shared only while navigating an active route inside RouteHub. This screen can request permission, but it does not upload your location.'}</p></div>
    {android && <div className={styles.row}>
      <span className={styles.rowCopy}><strong>{es ? 'Cámara' : fr ? 'Appareil photo' : 'Camera'}</strong><small>{access?.camera === 'granted' ? allowed('granted') : (es ? 'Para comprobantes; también puedes elegir una foto' : 'For proof; you can also choose a photo')}</small></span>
      <button type="button" className={styles.choice} disabled={busy || !access || access.camera === 'granted'} onClick={() => void deviceAccess.request({permission: 'camera'}).then(setAccess).catch(() => setError(es ? 'No se pudo solicitar el permiso.' : 'Permission request failed.'))}>{es ? 'Permitir' : 'Allow'}</button>
    </div>}
    <div className={styles.row}>
      <span className={styles.rowCopy}><strong>{es ? 'Ubicación' : fr ? 'Position' : 'Location'}</strong><small>{allowed(android ? access?.location || 'prompt' : location)}</small></span>
      <button type="button" className={styles.choice} disabled={busy || location === 'granted' || (android && access?.location === 'granted') || location === 'denied'} onClick={() => void requestLocation()}>{es ? 'Permitir' : fr ? 'Autoriser' : 'Allow'}</button>
    </div>
    <div className={styles.row}>
      <span className={styles.rowCopy}><strong>{es ? 'Notificaciones' : fr ? 'Notifications' : 'Notifications'}</strong><small>{allowed(notifications)}</small></span>
      <button type="button" className={styles.choice} disabled={busy || notifications === 'granted' || notifications === 'denied' || notifications === 'unavailable'} onClick={() => void requestNotifications()}>{es ? 'Permitir' : fr ? 'Autoriser' : 'Allow'}</button>
    </div>
    {android && native && <div className={styles.actionRow}><button type="button" className={styles.choice} onClick={() => void deviceAccess.openSettings().catch(() => setError(es ? 'No se pudieron abrir los ajustes.' : 'Could not open settings.'))}>{es ? 'Abrir ajustes de Android' : 'Open Android settings'}</button></div>}
    {(location === 'denied' || notifications === 'denied') && <p className={styles.footer}>{es ? 'El sistema ya rechazó este permiso. Ábrelo desde los ajustes de RouteHub en tu dispositivo.' : fr ? 'Le système a refusé cette autorisation. Activez-la dans les réglages de RouteHub sur votre appareil.' : 'The system denied this permission. Enable it in RouteHub’s device settings.'}</p>}
    {error && <p className={styles.footer} role="status">{error}</p>}
  </section>
}
