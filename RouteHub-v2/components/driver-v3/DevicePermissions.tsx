'use client'
import {Capacitor, registerPlugin} from '@capacitor/core'
import {useEffect, useState} from 'react'
import styles from '../../app/driver-v3/driver-preferences.module.css'

type Access = {location: string; camera: string; versionCode: number}
const device = registerPlugin<{
  status(): Promise<Access>
  request(options: {permission: 'location' | 'camera'}): Promise<Access>
  openSettings(): Promise<void>
}>('DeviceAccess')

export default function DevicePermissions({locale}: {locale: string}) {
  const [native, setNative] = useState(false)
  const [access, setAccess] = useState<Access | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const es = locale === 'es'
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    setNative(true)
    const refresh = () => { void device.status().then(setAccess).catch(() => setError(es ? 'Instala la APK nueva para gestionar permisos.' : 'Install the latest APK to manage permissions.')) }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [es])
  if (!native) return null
  const request = async (permission: 'location' | 'camera') => {
    setBusy(true)
    setError('')
    try { setAccess(await device.request({permission})) }
    catch { setError(es ? 'No se pudo solicitar el permiso. Revisa Ajustes de Android.' : 'Permission request failed. Check Android settings.') }
    finally { setBusy(false) }
  }
  return <section className={styles.section}>
    <div className={styles.sectionHeader}><h2>{es ? 'Permisos de Android' : 'Android permissions'}</h2>
      <p>{es ? 'Ubicación mientras usas la app y cámara para comprobantes. Puedes elegir fotos sin dar acceso a toda tu galería.' : 'Location while using the app and camera for delivery evidence. You can select photos without granting access to your entire library.'}</p></div>
    {(['location', 'camera'] as const).map(permission => <div className={styles.row} key={permission}>
      <span className={styles.rowCopy}><strong>{permission === 'location' ? (es ? 'Ubicación precisa' : 'Precise location') : (es ? 'Cámara' : 'Camera')}</strong>
        <small>{access?.[permission] === 'granted' ? (es ? 'Permitido' : 'Allowed') : (es ? 'Requiere permiso' : 'Permission needed')}</small></span>
      <button type="button" className={styles.choice} disabled={busy || !access || access[permission] === 'granted'} onClick={() => void request(permission)}>{es ? 'Permitir' : 'Allow'}</button>
    </div>)}
    <div className={styles.actionRow}><button type="button" className={styles.choice} onClick={() => void device.openSettings().catch(() => setError(es ? 'Instala la APK nueva.' : 'Install the latest APK.'))}>{es ? 'Abrir ajustes de Android' : 'Open Android settings'}</button></div>
    {error && <p className={styles.footer} role="status">{error}</p>}
  </section>
}
