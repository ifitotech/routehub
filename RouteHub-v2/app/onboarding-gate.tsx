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
        {eyebrow:'TU JORNADA', title:'Todo lo importante, primero', description:'Today mantiene la parada actual, el mapa y las acciones principales en una sola pantalla.', points:['Consulta la próxima parada de inmediato','Abre Google Maps con un toque','Botones grandes para trabajar en movimiento'], icon:Route, accent:'blue'},
        {eyebrow:'FLUJO SIMPLE', title:'Llega, confirma y continúa', description:'Cada tipo de parada muestra únicamente lo necesario para Pickup, Delivery o Return to Branch.', points:['Confirma el PO al recoger','Registra quién recibió la entrega','Añade foto, firma o nota cuando haga falta'], icon:ClipboardCheck, accent:'green'},
        {eyebrow:'SIEMPRE AL DÍA', title:'Rutas y cambios en tiempo real', description:'Activa las notificaciones en Settings para recibir asignaciones y cambios aun cuando RouteHub esté cerrada.', points:['Historial de los últimos 7 días','Ubicación compartida solo en jornada','Tus permisos siempre bajo tu control'], icon:BellRing, accent:'violet'},
      ] satisfies Slide[],
      manager:[
        {eyebrow:'OPERACIÓN DIARIA', title:'Crea y asigna en segundos', description:'Publica Pickup y Delivery con la información exacta que necesita el driver.', points:['Contactos y direcciones guardadas','Driver y punto de salida preseleccionados','PO, instrucciones y prioridad cuando aplican'], icon:Route, accent:'blue'},
        {eyebrow:'CONTROL EN VIVO', title:'Sigue la operación sin ruido', description:'Today reúne rutas activas, drivers conectados, incidencias y accesos rápidos.', points:['Estado actual de cada driver','Mapa y progreso de la ruta','Alertas que requieren tu atención'], icon:MapPinned, accent:'green'},
        {eyebrow:'EQUIPO Y EVIDENCIA', title:'Todo queda organizado', description:'Revisa quién completó cada parada, la evidencia disponible y el historial del equipo.', points:['Foto, firma y nombre del receptor','Invitaciones y miembros del equipo','Historial e incidencias en un solo lugar'], icon:UsersRound, accent:'violet'},
      ] satisfies Slide[],
    }
    if (locale === 'fr') return {
      skip:'Ignorer', next:'Suivant', finish:'Commencer', step:'Étape', of:'sur', dialog:'Découvrir RouteHub', replay:'Visite RouteHub',
      driver:[
        {eyebrow:'VOTRE JOURNÉE', title:'L’essentiel en premier', description:'Today garde l’arrêt actuel, la carte et les actions principales sur un seul écran.', points:['Consultez immédiatement le prochain arrêt','Ouvrez Google Maps en un geste','De grands boutons pour travailler en mouvement'], icon:Route, accent:'blue'},
        {eyebrow:'FLUX SIMPLE', title:'Arrivez, confirmez, continuez', description:'Chaque arrêt affiche uniquement ce qui est nécessaire pour la collecte, la livraison ou le retour.', points:['Confirmez le PO à la collecte','Enregistrez le nom du destinataire','Ajoutez photo, signature ou note si nécessaire'], icon:ClipboardCheck, accent:'green'},
        {eyebrow:'TOUJOURS À JOUR', title:'Itinéraires en temps réel', description:'Activez les notifications dans Settings pour recevoir les changements même lorsque RouteHub est fermée.', points:['Historique des 7 derniers jours','Position partagée pendant la journée','Vos autorisations restent sous votre contrôle'], icon:BellRing, accent:'violet'},
      ] satisfies Slide[],
      manager:[
        {eyebrow:'OPÉRATIONS DU JOUR', title:'Créez et attribuez rapidement', description:'Publiez les collectes et livraisons avec les informations utiles au chauffeur.', points:['Contacts et adresses enregistrés','Chauffeur et départ présélectionnés','PO, instructions et priorité si nécessaire'], icon:Route, accent:'blue'},
        {eyebrow:'SUIVI EN DIRECT', title:'Suivez sans distraction', description:'Today regroupe itinéraires actifs, chauffeurs connectés, incidents et raccourcis.', points:['État actuel de chaque chauffeur','Carte et progression','Alertes nécessitant votre attention'], icon:MapPinned, accent:'green'},
        {eyebrow:'ÉQUIPE ET PREUVES', title:'Tout reste organisé', description:'Consultez la fin de chaque arrêt, les preuves et l’historique de l’équipe.', points:['Photo, signature et destinataire','Invitations et membres','Historique et incidents au même endroit'], icon:UsersRound, accent:'violet'},
      ] satisfies Slide[],
    }
    return {
      skip:'Skip', next:'Next', finish:'Get started', step:'Step', of:'of', dialog:'Meet RouteHub', replay:'RouteHub tour',
      driver:[
        {eyebrow:'YOUR DRIVING DAY', title:'What matters, right up front', description:'Today keeps the current stop, map and main actions together on one screen.', points:['See the next stop immediately','Open Google Maps with one tap','Large controls for working on the move'], icon:Route, accent:'blue'},
        {eyebrow:'A SIMPLE FLOW', title:'Arrive, confirm and continue', description:'Each stop shows only what is needed for Pickup, Delivery or Return to Branch.', points:['Confirm the PO at pickup','Record who received a delivery','Add a photo, signature or note when useful'], icon:ClipboardCheck, accent:'green'},
        {eyebrow:'STAY UPDATED', title:'Routes and changes in real time', description:'Enable notifications in Settings to receive assignments and changes even when RouteHub is closed.', points:['Seven days of recent history','Location shared only during the workday','You stay in control of every permission'], icon:BellRing, accent:'violet'},
      ] satisfies Slide[],
      manager:[
        {eyebrow:'DAILY OPERATIONS', title:'Create and assign in seconds', description:'Publish Pickup and Delivery stops with exactly what the driver needs.', points:['Saved contacts and addresses','Driver and starting point preselected','PO, instructions and priority when needed'], icon:Route, accent:'blue'},
        {eyebrow:'LIVE CONTROL', title:'Follow the work without clutter', description:'Today brings active routes, connected drivers, issues and quick actions together.', points:['Current status for every driver','Live route map and progress','Alerts that need your attention'], icon:MapPinned, accent:'green'},
        {eyebrow:'TEAM AND PROOF', title:'Everything stays organized', description:'Review stop completion, available proof and your team history.', points:['Photo, signature and recipient name','Team members and invitations','History and issues in one place'], icon:UsersRound, accent:'violet'},
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
