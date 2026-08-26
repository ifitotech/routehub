'use client'

import {Bell, BellRing, Download, ExternalLink, PlusSquare, Share, Smartphone, X} from 'lucide-react'
import {useEffect, useMemo, useState} from 'react'
import {useLocale} from '../lib/use-preferences'
import {registerPushNotifications} from '../lib/push-notifications'

type InstallPrompt = Event & {prompt?: () => Promise<void>}

function standalone() {
  return typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone))
}

export default function InstallAppCard() {
  const {locale} = useLocale()
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [open, setOpen] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [notificationState, setNotificationState] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [notificationBusy, setNotificationBusy] = useState(false)
  const copy = useMemo(() => locale === 'es'
    ? {title:'Instalar RouteHub',help:'Instala la app para abrirla más rápido y recibir notificaciones.',install:'Instalar app',guide:'Ver guía',close:'Cerrar',iphone:'En iPhone: abre RouteHub en Safari, pulsa Compartir y luego “Añadir a pantalla de inicio”. Después abre la app desde el nuevo icono.',android:'En Android: abre RouteHub en Chrome y pulsa “Instalar app” o “Añadir a pantalla de inicio”.'}
    : locale === 'fr'
      ? {title:'Installer RouteHub',help:'Installez l’application pour un accès rapide et les notifications.',install:'Installer',guide:'Voir le guide',close:'Fermer',iphone:'Sur iPhone : ouvrez RouteHub dans Safari, touchez Partager, puis « Ajouter à l’écran d’accueil ». Ouvrez ensuite l’app depuis la nouvelle icône.',android:'Sur Android : ouvrez RouteHub dans Chrome et touchez « Installer l’application » ou « Ajouter à l’écran d’accueil ». '}
      : {title:'Install RouteHub',help:'Install the app for faster access and route notifications.',install:'Install app',guide:'View guide',close:'Close',iphone:'On iPhone: open RouteHub in Safari, tap Share, then “Add to Home Screen”. Open RouteHub from the new icon.',android:'On Android: open RouteHub in Chrome and tap “Install app” or “Add to Home screen”.'}, [locale])

  useEffect(() => {
    setInstalled(standalone())
    if (typeof Notification !== 'undefined') setNotificationState(Notification.permission)
    const onPrompt = (event: Event) => setPrompt(event as InstallPrompt)
    const onInstalled = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('routehub:install-available', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('routehub:install-available', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  if (installed) {
    if (notificationState === 'granted' || notificationState === 'denied') return null
    const enableNotifications = async () => {
      setNotificationBusy(true)
      try { await registerPushNotifications(); setNotificationState('granted') }
      catch { if (typeof Notification !== 'undefined') setNotificationState(Notification.permission) }
      finally { setNotificationBusy(false) }
    }
    return <section className="card settings-card install-app-card notification-install-prompt"><div><h2><Bell size={19}/> {locale === 'es' ? 'Activa las notificaciones' : 'Enable notifications'}</h2><p className="muted">{locale === 'es' ? 'Recibe avisos de rutas aunque RouteHub esté cerrada.' : 'Receive route alerts even when RouteHub is closed.'}</p></div><button className="primary" type="button" disabled={notificationBusy} onClick={() => void enableNotifications()}><BellRing size={16}/>{notificationBusy ? '…' : (locale === 'es' ? 'Activar' : 'Enable')}</button></section>
  }
  const iphone = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const install = async () => { if (prompt?.prompt) { await prompt.prompt(); setPrompt(null) } else setOpen(true) }
  return <>
    <section className="card settings-card install-app-card"><div><h2><Download size={19}/> {copy.title}</h2><p className="muted">{copy.help}</p></div><button className="primary" type="button" onClick={install}>{prompt?.prompt ? copy.install : copy.guide}<ExternalLink size={16}/></button></section>
    {open && <div className="install-guide-backdrop" role="presentation" onMouseDown={event => {if (event.target === event.currentTarget) setOpen(false)}}><section className="install-guide" role="dialog" aria-modal="true" aria-labelledby="install-guide-title"><button className="install-guide-close" type="button" onClick={() => setOpen(false)} aria-label={copy.close}><X size={20}/></button><h2 id="install-guide-title">{copy.title}</h2>{iphone ? <><div className="install-visual" aria-hidden="true"><div><Smartphone size={25}/><b>Safari</b></div><span>→</span><div><Share size={25}/><b>Share</b></div><span>→</span><div><PlusSquare size={25}/><b>Add</b></div></div><div className="install-steps"><div><b>1</b><span><strong>Open Safari</strong><small>Use Safari on your iPhone or iPad.</small></span></div><div><b>2</b><span><strong>Tap Share</strong><small>Tap the Share icon at the bottom of Safari.</small></span></div><div><b>3</b><span><strong>Add to Home Screen</strong><small>Scroll down, choose “Add to Home Screen”, then tap Add.</small></span></div></div></> : <p>{copy.android}</p>}<button className="primary" type="button" onClick={() => setOpen(false)}>{copy.close}</button></section></div>}
  </>
}
