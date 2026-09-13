'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {usePathname} from 'next/navigation'
import {BellRing, Check, ChevronRight, ClipboardCheck, MapPinned, Route, Truck, UsersRound, X} from 'lucide-react'
import {getSupabase} from '../lib/supabase'
import {useLocale} from '../lib/use-preferences'
import {ONBOARDING_REPLAY_EVENT, onboardingStorageKey, type OnboardingAudience} from '../lib/onboarding'
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
  const dialogRef = useRef<HTMLElement>(null)

  const copy = useMemo(() => {
    if (locale === 'es') return {
      skip:'Omitir', next:'Siguiente', finish:'Empezar', step:'Paso', of:'de', dialog:'Conoce RouteHub', replay:'Recorrido de RouteHub',
      driver:[
        {eyebrow:'TU JORNADA', title:'Todo lo importante, primero', description:'Today mantiene la parada actual, el mapa y las acciones principales en una sola pantalla. Actívala con Driving Day antes de salir.', points:['Consulta la próxima parada de inmediato','Abre Apple o Google Maps con un toque','Botones grandes para trabajar en movimiento'], icon:Route, accent:'blue'},
        {eyebrow:'FLUJO SIMPLE', title:'Llega, confirma y continúa', description:'Cada tipo de parada muestra únicamente lo necesario: Recogida, Entrega o Retorno a sucursal. Si algo sale mal, usa Issue.', points:['Confirma el material al recoger','Registra quién recibió la entrega','Añade foto o firma cuando haga falta'], icon:ClipboardCheck, accent:'green'},
        {eyebrow:'SIEMPRE AL DÍA', title:'Todo bajo tu control', description:'En Configuración ves tu sucursal, activas notificaciones que sí puedes apagar del todo y puedes escribirle a soporte.', points:['Notificaciones de rutas nuevas y cambios','Combustible y mantenimiento desde Camión','Contactar soporte sin salir de la app'], icon:BellRing, accent:'violet'},
      ] satisfies Slide[],
      manager:[
        {eyebrow:'RUTAS EN SEGUNDOS', title:'Crea y asigna en segundos', description:'Arma una ruta con origen, destino y chofer en tres pasos — el panel de detalles siempre está visible.', points:['Origen: sucursal, último punto o dirección personalizada','Contacto y destino fusionados en una tarjeta','PO, notas y prioridad cuando aplican'], icon:Route, accent:'blue'},
        {eyebrow:'TU PANEL', title:'Todo en una pantalla', description:'El Panel reúne el calendario de la semana, las rutas del día y el mapa de la sucursal juntos.', points:['Rutas pendientes y completadas lado a lado','Ubicación del chofer en vivo, con su consentimiento','Buscador de destinos de días anteriores'], icon:MapPinned, accent:'green'},
        {eyebrow:'EQUIPO E HISTORIAL', title:'Todo queda organizado', description:'Invita a tu equipo y revisa el trabajo completado con su evidencia.', points:['Foto, firma y nombre de quien recibió','Equipo, roles y chofer principal en un solo lugar','Historial y Reportes filtrables por fecha y chofer'], icon:UsersRound, accent:'violet'},
      ] satisfies Slide[],
    }
    if (locale === 'fr') return {
      skip:'Ignorer', next:'Suivant', finish:'Commencer', step:'Étape', of:'sur', dialog:'Découvrir RouteHub', replay:'Visite RouteHub',
      driver:[
        {eyebrow:'VOTRE JOURNÉE', title:'L’essentiel en premier', description:'Today garde l’arrêt actuel, la carte et les actions principales sur un seul écran. Activez-la avec Driving Day avant de partir.', points:['Consultez immédiatement le prochain arrêt','Ouvrez Apple ou Google Maps en un geste','De grands boutons pour travailler en mouvement'], icon:Route, accent:'blue'},
        {eyebrow:'FLUX SIMPLE', title:'Arrivez, confirmez, continuez', description:'Chaque arrêt affiche uniquement ce qui est nécessaire : Collecte, Livraison ou Retour à la succursale. En cas de problème, utilisez Incident.', points:['Confirmez le matériel à la collecte','Enregistrez le nom du destinataire','Ajoutez photo ou signature si nécessaire'], icon:ClipboardCheck, accent:'green'},
        {eyebrow:'TOUJOURS À JOUR', title:'Tout sous contrôle', description:'Dans Paramètres, retrouvez votre succursale, des notifications que vous pouvez vraiment désactiver, et l’assistance en un message.', points:['Alertes de nouveaux itinéraires et changements','Carburant et entretien depuis Camion','Contacter l’assistance sans quitter l’app'], icon:BellRing, accent:'violet'},
      ] satisfies Slide[],
      manager:[
        {eyebrow:'ITINÉRAIRES RAPIDES', title:'Créez et attribuez rapidement', description:'Créez un itinéraire avec départ, destination et chauffeur en trois étapes - le panneau de détails reste toujours visible.', points:['Départ : succursale, dernier arrêt ou adresse personnalisée','Contact et destination réunis sur une carte','PO, notes et priorité si nécessaire'], icon:Route, accent:'blue'},
        {eyebrow:'VOTRE TABLEAU DE BORD', title:'Tout sur un seul écran', description:'Le tableau de bord réunit le calendrier de la semaine, les itinéraires du jour et la carte de la succursale.', points:['Itinéraires en attente et terminés côte à côte','Position du chauffeur en direct, avec son accord','Recherche de destinations des jours précédents'], icon:MapPinned, accent:'green'},
        {eyebrow:'ÉQUIPE ET HISTORIQUE', title:'Tout reste organisé', description:'Invitez votre équipe et consultez le travail terminé avec ses preuves.', points:['Photo, signature et nom du destinataire','Équipe, rôles et chauffeur principal au même endroit','Historique et rapports filtrables par date et chauffeur'], icon:UsersRound, accent:'violet'},
      ] satisfies Slide[],
    }
    return {
      skip:'Skip', next:'Next', finish:'Get started', step:'Step', of:'of', dialog:'Meet RouteHub', replay:'RouteHub tour',
      driver:[
        {eyebrow:'YOUR DRIVING DAY', title:'What matters, right up front', description:'Today keeps the current stop, map and main actions together on one screen. Turn it on with Driving Day before you head out.', points:['See the next stop immediately','Open Apple or Google Maps with one tap','Large controls for working on the move'], icon:Route, accent:'blue'},
        {eyebrow:'A SIMPLE FLOW', title:'Arrive, confirm and continue', description:'Each stop shows only what is needed: Pickup, Delivery or Return to branch. If something goes wrong, use Issue.', points:['Confirm the material at pickup','Record who received a delivery','Add a photo or signature when useful'], icon:ClipboardCheck, accent:'green'},
        {eyebrow:'STAY IN CONTROL', title:'Everything at your fingertips', description:'Settings shows your branch, notifications you can actually turn off, and a direct line to support.', points:['Alerts for new routes and changes','Fuel and maintenance from Truck','Contact support without leaving the app'], icon:BellRing, accent:'violet'},
      ] satisfies Slide[],
      manager:[
        {eyebrow:'ROUTES IN SECONDS', title:'Create and assign in seconds', description:'Build a route with origin, destination and driver in three steps - the details panel is always visible.', points:['Origin: branch, last stop or a custom address','Contact and destination merged into one card','PO, notes and priority when needed'], icon:Route, accent:'blue'},
        {eyebrow:'YOUR DASHBOARD', title:'Everything on one screen', description:'The Dashboard brings the weekly calendar, the day\'s routes and the branch map together.', points:['Pending and completed routes side by side','Live driver location, with their consent','Destination search across previous days'], icon:MapPinned, accent:'green'},
        {eyebrow:'TEAM AND HISTORY', title:'Everything stays organized', description:'Invite your team and review completed work along with its proof.', points:['Photo, signature and recipient name','Team, roles and primary driver in one place','History and Reports, filterable by date and driver'], icon:UsersRound, accent:'violet'},
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

  return <div className={styles.backdrop} role="presentation">
    <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-label={copy.dialog}>
      <header className={styles.header}>
        <div className={styles.brand}><Truck size={20}/><strong>RouteHub</strong></div>
        <button className={styles.close} type="button" aria-label={copy.skip} onClick={complete}><X size={21}/></button>
      </header>
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
    </section>
  </div>
}
