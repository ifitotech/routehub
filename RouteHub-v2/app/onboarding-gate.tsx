'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {usePathname} from 'next/navigation'
import {BellRing, Check, ChevronRight, ClipboardCheck, MapPinned, Route, Truck, UsersRound, X} from 'lucide-react'
import {getSupabase} from '../lib/supabase'
import {useLocale} from '../lib/use-preferences'
import {driverDeviceSetupKey, ONBOARDING_REPLAY_EVENT, onboardingStorageKey, type OnboardingAudience} from '../lib/onboarding'
import {prepareDriverDevice, type DriverDeviceSetupResult} from '../lib/driver-device-setup'
import {resolveAccess} from './auth-access'
import styles from './onboarding.module.css'

type Slide = {
  eyebrow: string
  title: string
  description: string
  points: string[]
  icon: typeof Route
  accent: 'blue' | 'green' | 'violet'
}

const PUBLIC_PATHS = ['/', '/login', '/auth/callback', '/activate-invitation', '/product', '/how-it-works', '/for-drivers']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(path => pathname === path || (path !== '/' && pathname.startsWith(path)))
}

export default function OnboardingGate() {
  const pathname = usePathname()
  const {locale} = useLocale()
  const [open, setOpen] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [identity, setIdentity] = useState<{userId: string; audience: OnboardingAudience} | null>(null)
  const [deviceSetupNeeded, setDeviceSetupNeeded] = useState(false)
  const [deviceSetupBusy, setDeviceSetupBusy] = useState(false)
  const [deviceSetupResult, setDeviceSetupResult] = useState<DriverDeviceSetupResult | null>(null)
  const dialogRef = useRef<HTMLElement>(null)

  const copy = useMemo(() => {
    if (locale === 'es') return {
      skip:'Omitir', next:'Siguiente', finish:'Empezar', step:'Paso', of:'de', dialog:'Conoce RouteHub', replay:'Recorrido de RouteHub',
      driver:[
        {eyebrow:'TU JORNADA', title:'Ruta y navegación en un solo lugar', description:'Today muestra la parada actual. Al comenzar, la navegación se abre dentro de RouteHub o en Apple/Google Maps, según el plan y tu preferencia.', points:['Volver a Today conserva la ruta iniciada','Toca el mapa para reabrir la navegación','Simple y Pro muestran distintos niveles de detalle'], icon:Route, accent:'blue'},
        {eyebrow:'CADA PARADA', title:'Llega, confirma y continúa', description:'El panel cambia según sea Recogida, Entrega o Retorno. Al registrar la llegada, aparece el flujo adecuado para completar la parada.', points:['Confirma el material al recoger','Registra quién recibió la entrega','Añade foto, firma o incidencia cuando corresponda'], icon:ClipboardCheck, accent:'green'},
        {eyebrow:'UBICACIÓN Y AYUDA', title:'Tú controlas cuándo compartir ubicación', description:'RouteHub usa la ubicación durante una ruta activa con la navegación interna abierta. Tus preferencias, idioma y tema están en Más.', points:['No se comparte ubicación desde Today ni con mapas externos','Recibe avisos de rutas y cambios si permites notificaciones','Ayuda y soporte desde Más'], icon:BellRing, accent:'violet'},
      ] satisfies Slide[],
      manager:[
        {eyebrow:'PLANIFICA Y ASIGNA', title:'Prepara las rutas desde Rutas', description:'Crea recogidas, entregas y retornos con sus datos de origen, destino, conductor y horario. Al publicarla, queda disponible para el Driver asignado.', points:['Guarda contactos y direcciones frecuentes','Incluye PO, notas y prioridad cuando hagan falta','Revisa la asignación antes de publicar'], icon:Route, accent:'blue'},
        {eyebrow:'SEGUIMIENTO DEL DÍA', title:'Ve cada ruta por su estado', description:'Rutas organiza el trabajo de hoy, lo programado, lo que está en progreso y lo completado. La ubicación en vivo aparece cuando el conductor comparte ubicación durante navegación interna activa.', points:['Abre el detalle de una ruta para ver su progreso','Consulta el mapa y la ubicación reciente del Driver','Revisa la evidencia cuando se completa una parada'], icon:MapPinned, accent:'green'},
        {eyebrow:'EQUIPO E HISTORIAL', title:'Mantén la operación organizada', description:'Administra el acceso del equipo y consulta la actividad terminada desde Historial y Reportes.', points:['Asigna roles según las tareas de cada persona','Consulta fotos, firmas y notas guardadas','Filtra la actividad por fecha y conductor'], icon:UsersRound, accent:'violet'},
      ] satisfies Slide[],
    }
    if (locale === 'fr') return {
      skip:'Ignorer', next:'Suivant', finish:'Commencer', step:'Étape', of:'sur', dialog:'Découvrir RouteHub', replay:'Visite RouteHub',
      driver:[
        {eyebrow:'VOTRE JOURNÉE', title:'Itinéraire et navigation réunis', description:'Today affiche l’arrêt actuel. Au démarrage, la navigation s’ouvre dans RouteHub ou dans Apple/Google Maps selon le forfait et votre préférence.', points:['Retourner à Today conserve l’itinéraire commencé','Touchez la carte pour rouvrir la navigation','Simple et Pro présentent différents niveaux de détail'], icon:Route, accent:'blue'},
        {eyebrow:'CHAQUE ARRÊT', title:'Arrivez, confirmez, continuez', description:'Le panneau s’adapte à une collecte, une livraison ou un retour. Après l’arrivée, le formulaire adapté s’affiche.', points:['Confirmez le matériel à la collecte','Indiquez qui a reçu la livraison','Ajoutez photo, signature ou incident si nécessaire'], icon:ClipboardCheck, accent:'green'},
        {eyebrow:'POSITION ET AIDE', title:'Vous contrôlez le partage de position', description:'RouteHub utilise votre position pendant un itinéraire actif avec la navigation intégrée ouverte. Vos préférences, la langue et le thème se trouvent dans Plus.', points:['Aucun partage depuis Today ou avec une carte externe','Alertes d’itinéraire si vous autorisez les notifications','Aide et assistance dans Plus'], icon:BellRing, accent:'violet'},
      ] satisfies Slide[],
      manager:[
        {eyebrow:'PLANIFIER ET ATTRIBUER', title:'Préparez les itinéraires dans Itinéraires', description:'Créez des collectes, livraisons et retours avec leur départ, destination, conducteur et horaire. La publication rend l’itinéraire disponible au Driver attribué.', points:['Enregistrez les contacts et adresses fréquents','Ajoutez PO, notes et priorité si nécessaire','Vérifiez l’attribution avant la publication'], icon:Route, accent:'blue'},
        {eyebrow:'SUIVI DU JOUR', title:'Suivez chaque itinéraire par état', description:'Itinéraires organise le travail du jour, les tâches planifiées, en cours et terminées. La position en direct apparaît pendant la navigation intégrée active avec le consentement du conducteur.', points:['Ouvrez le détail pour voir la progression','Consultez la carte et la position récente du Driver','Vérifiez les preuves après la fin d’un arrêt'], icon:MapPinned, accent:'green'},
        {eyebrow:'ÉQUIPE ET HISTORIQUE', title:'Gardez l’opération organisée', description:'Gérez les accès de l’équipe et consultez l’activité terminée dans Historique et Rapports.', points:['Attribuez les rôles selon les tâches','Consultez les photos, signatures et notes enregistrées','Filtrez l’activité par date et conducteur'], icon:UsersRound, accent:'violet'},
      ] satisfies Slide[],
    }
    return {
      skip:'Skip', next:'Next', finish:'Get started', step:'Step', of:'of', dialog:'Meet RouteHub', replay:'RouteHub tour',
      driver:[
        {eyebrow:'YOUR DRIVING DAY', title:'Route and navigation together', description:'Today shows the current stop. When you start, navigation opens in RouteHub or Apple/Google Maps based on your plan and preference.', points:['Returning to Today keeps your started route','Tap the map to reopen navigation','Simple and Pro show different levels of detail'], icon:Route, accent:'blue'},
        {eyebrow:'EACH STOP', title:'Arrive, confirm and continue', description:'The panel adapts to Pickup, Delivery or Return. After arrival, the right completion flow appears.', points:['Confirm materials at pickup','Record who received a delivery','Add a photo, signature or issue when required'], icon:ClipboardCheck, accent:'green'},
        {eyebrow:'LOCATION AND HELP', title:'You control location sharing', description:'RouteHub uses location during an active route with in-app navigation open. Your preferences, language and theme are in More.', points:['No location sharing from Today or external maps','Route alerts if you allow notifications','Help and support live in More'], icon:BellRing, accent:'violet'},
      ] satisfies Slide[],
      manager:[
        {eyebrow:'PLAN AND ASSIGN', title:'Prepare routes from Routes', description:'Create pickups, deliveries and returns with their origin, destination, driver and schedule. Publishing makes the route available to its assigned Driver.', points:['Save frequent contacts and addresses','Add PO, notes and priority when needed','Review the assignment before publishing'], icon:Route, accent:'blue'},
        {eyebrow:'DAILY OPERATIONS', title:'Follow routes by status', description:'Routes organizes today’s work, scheduled routes, work in progress and completed stops. Live location appears while the Driver shares location during active in-app navigation.', points:['Open a route’s details to see progress','Review the map and the Driver’s recent location','Check proof after a stop is completed'], icon:MapPinned, accent:'green'},
        {eyebrow:'TEAM AND HISTORY', title:'Keep operations organized', description:'Manage team access and review completed work in History and Reports.', points:['Assign roles based on each person’s work','Review saved photos, signatures and notes','Filter activity by date and Driver'], icon:UsersRound, accent:'violet'},
      ] satisfies Slide[],
    }
  }, [locale])

  const resolveIdentity = useCallback(async (force = false) => {
    if (isPublicPath(pathname)) return
    try {
      const access = await resolveAccess(getSupabase())
      const audience: OnboardingAudience | null = access.role === 'driver'
        ? 'driver'
        : ['branch_manager', 'operations_manager', 'sales_representative', 'counter_sales'].includes(access.role)
          ? 'manager'
          : null
      if (!audience) return
      const nextIdentity = {userId: access.user.id, audience}
      setIdentity(nextIdentity)
      setDeviceSetupNeeded(audience === 'driver' && window.localStorage.getItem(driverDeviceSetupKey(nextIdentity.userId)) !== 'complete')
      setDeviceSetupResult(null)
      if (force || window.localStorage.getItem(onboardingStorageKey(nextIdentity.userId, audience)) !== 'complete') {
        setSlideIndex(0)
        setOpen(true)
      }
    } catch {
      // AuthBoundary owns authentication and role errors. The tour never
      // blocks access if the session cannot be resolved here.
    }
  }, [pathname])

  const complete = useCallback(() => {
    if (identity) window.localStorage.setItem(onboardingStorageKey(identity.userId, identity.audience), 'complete')
    setOpen(false)
    setSlideIndex(0)
  }, [identity])

  const prepareDevice = useCallback(async () => {
    if (!identity || identity.audience !== 'driver' || deviceSetupBusy) return
    setDeviceSetupBusy(true)
    try {
      const result = await prepareDriverDevice()
      setDeviceSetupResult(result)
      // Remember the attempt. OS-denied permissions cannot be prompted again
      // from a webpage; the driver gets an explanation instead of a prompt loop.
      window.localStorage.setItem(driverDeviceSetupKey(identity.userId), 'complete')
    } finally {
      setDeviceSetupBusy(false)
    }
  }, [deviceSetupBusy, identity])

  useEffect(() => { void resolveIdentity(false) }, [resolveIdentity])
  useEffect(() => {
    const replay = () => void resolveIdentity(true)
    window.addEventListener(ONBOARDING_REPLAY_EVENT, replay)
    return () => window.removeEventListener(ONBOARDING_REPLAY_EVENT, replay)
  }, [resolveIdentity])
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { complete(); return }
      if (event.key !== 'Tab') return
      const controls = focusable()
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown) }
  }, [complete, open])

  if (!open || !identity) return null
  const slides = copy[identity.audience]
  const slide = slides[slideIndex]
  const Icon = slide.icon
  const isLast = slideIndex === slides.length - 1
  const permissionCopy = locale === 'es' ? {
    eyebrow:'PREPARA TU DISPOSITIVO', title:'Permisos para usar RouteHub', description:'Al continuar, tu iPhone o Android te preguntará si permites notificaciones y ubicación. La ubicación solo se usa durante una ruta activa con la navegación interna abierta; esta preparación no envía tu posición.',
    location:'Ubicación para centrar y actualizar el mapa durante la navegación interna.', notifications:'Avisos de rutas asignadas y cambios importantes.', button:'Permitir y continuar', continue:'Continuar al recorrido', later:'Ahora no', busy:'Solicitando permisos…', granted:'Permitido', denied:'No permitido. Puedes activarlo en los ajustes del dispositivo.', unavailable:'No disponible en este navegador o dispositivo.', error:'No se pudo completar. Revisa los ajustes si ya rechazaste el permiso.',
  } : locale === 'fr' ? {
    eyebrow:'PRÉPAREZ VOTRE APPAREIL', title:'Autorisations RouteHub', description:'En continuant, votre iPhone ou Android vous demandera d’autoriser les notifications et la position. La position est utilisée uniquement pendant un itinéraire actif avec la navigation intégrée ouverte; cette étape n’envoie pas votre position.',
    location:'Position pour centrer et actualiser la carte pendant la navigation intégrée.', notifications:'Alertes pour les nouveaux itinéraires et changements importants.', button:'Autoriser et continuer', continue:'Continuer la visite', later:'Plus tard', busy:'Demande des autorisations…', granted:'Autorisé', denied:'Non autorisé. Vous pouvez l’activer dans les réglages de l’appareil.', unavailable:'Indisponible sur ce navigateur ou appareil.', error:'Impossible de terminer. Vérifiez les réglages si vous avez déjà refusé.',
  } : {
    eyebrow:'SET UP YOUR DEVICE', title:'Permissions for RouteHub', description:'Continue to let your iPhone or Android ask whether RouteHub can send notifications and use location. Location is only used during an active route with in-app navigation open; this setup does not send your position.',
    location:'Location to center and update the map during in-app navigation.', notifications:'Alerts for assigned routes and important changes.', button:'Allow and continue', continue:'Continue to the tour', later:'Not now', busy:'Requesting permissions…', granted:'Allowed', denied:'Not allowed. You can enable it in device settings.', unavailable:'Unavailable in this browser or device.', error:'Could not finish. Check device settings if you previously denied access.',
  }
  const permissionStatus = (value: DriverDeviceSetupResult[keyof DriverDeviceSetupResult]) => permissionCopy[value]

  return <div className={styles.backdrop} role="presentation">
    <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-label={copy.dialog}>
      <header className={styles.header}>
        <div className={styles.brand}><Truck size={20}/><strong>RouteHub</strong></div>
        <button className={styles.close} type="button" aria-label={copy.skip} onClick={complete}><X size={21}/></button>
      </header>
      {deviceSetupNeeded ? <>
      <div className={`${styles.visual} ${styles.blue}`}>
        <div className={styles.routeLine} aria-hidden="true"><i/><i/><i/></div>
        <div className={styles.heroIcon}><MapPinned size={44}/></div>
        <div className={styles.previewCard}><span>ROUTEHUB DRIVER</span><strong>{locale==='es'?'Ruta activa, ubicación protegida':locale==='fr'?'Itinéraire actif, position protégée':'Active route, protected location'}</strong><small><i/>{locale==='es'?'Solo durante navegación interna':locale==='fr'?'Navigation intégrée uniquement':'Only during in-app navigation'}</small></div>
      </div>
      <div className={styles.content}>
        <span className={styles.eyebrow}>{permissionCopy.eyebrow}</span>
        <h2>{permissionCopy.title}</h2>
        <p>{permissionCopy.description}</p>
        <ul><li><MapPinned size={16}/><span>{permissionCopy.location}</span></li><li><BellRing size={16}/><span>{permissionCopy.notifications}</span></li></ul>
        {deviceSetupResult&&<div className={styles.permissionResults} role="status">
          <p><strong>{locale==='es'?'Ubicación':locale==='fr'?'Position':'Location'}:</strong> {permissionStatus(deviceSetupResult.location)}</p>
          <p><strong>{locale==='es'?'Notificaciones':locale==='fr'?'Notifications':'Notifications'}:</strong> {permissionStatus(deviceSetupResult.notifications)}</p>
        </div>}
      </div>
      <footer className={styles.footer}><div className={styles.actions}>
        <button className={styles.skip} type="button" disabled={deviceSetupBusy} onClick={()=>setDeviceSetupNeeded(false)}>{permissionCopy.later}</button>
        <button className={styles.next} type="button" disabled={deviceSetupBusy} onClick={()=>deviceSetupResult?setDeviceSetupNeeded(false):void prepareDevice()}>{deviceSetupBusy?permissionCopy.busy:deviceSetupResult?permissionCopy.continue:permissionCopy.button}<ChevronRight size={18}/></button>
      </div></footer>
      </> : <>
      <div className={`${styles.visual} ${styles[slide.accent]}`}>
        <div className={styles.routeLine} aria-hidden="true"><i/><i/><i/></div>
        <div className={styles.heroIcon}><Icon size={44}/></div>
        <div className={styles.previewCard}>
          <span>{identity.audience === 'driver' ? (locale === 'es' ? 'PARADA ACTUAL' : locale === 'fr' ? 'ARRÊT ACTUEL' : 'CURRENT STOP') : (locale === 'es' ? 'EN VIVO' : locale === 'fr' ? 'EN DIRECT' : 'LIVE')}</span>
          <strong>{identity.audience === 'driver' ? (locale === 'es' ? 'Siguiente destino' : locale === 'fr' ? 'Prochaine destination' : 'Next destination') : (locale === 'es' ? 'Operación conectada' : locale === 'fr' ? 'Opérations connectées' : 'Connected operations')}</strong>
          <small><i/>{locale === 'es' ? 'Actualizado ahora' : locale === 'fr' ? 'Mis à jour maintenant' : 'Updated now'}</small>
        </div>
      </div>
      <div className={styles.content}>
        <span className={styles.eyebrow}>{slide.eyebrow}</span>
        <h2>{slide.title}</h2>
        <p>{slide.description}</p>
        <ul>{slide.points.map(point => <li key={point}><Check size={16}/><span>{point}</span></li>)}</ul>
      </div>
      <footer className={styles.footer}>
        <div className={styles.progress} aria-label={`${copy.step} ${slideIndex + 1} ${copy.of} ${slides.length}`}>
          {slides.map((_, index) => <i key={index} className={index === slideIndex ? styles.activeDot : ''}/>) }
        </div>
        <div className={styles.actions}>
          <button className={styles.skip} type="button" onClick={complete}>{copy.skip}</button>
          <button className={styles.next} type="button" onClick={() => isLast ? complete() : setSlideIndex(index => index + 1)}>{isLast ? copy.finish : copy.next}<ChevronRight size={18}/></button>
        </div>
      </footer>
      </>}
    </section>
  </div>
}
