'use client'
import Link from 'next/link'
import {
  Bell,
  CalendarDays,
  CircleHelp,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Shield,
  Truck,
} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useLocale} from '../../../lib/use-preferences'
import {DRIVER_APP_VERSION} from '../../../lib/driver-app-version'
import styles from '../driver-preferences.module.css'

function topics(locale: string) {
  if (locale === 'es') {
    return [
      ['Today', 'Ahí sale la parada asignada: tipo (recogida, entrega o retorno), dirección, contacto y PO. Si no hay paradas, la sucursal todavía no te asignó trabajo.'],
      ['Cómo completar', 'Inicia la ruta, marca Llegué y completa. Recogida: confirma que llevas el material. Entrega: nombre de quien recibe, foto o firma. Retorno: llegar a la sucursal, sin PO.'],
      ['Issue', 'Si el cliente no está, la dirección falla o hay daño, usa Issue en la parada. Queda en el historial para la sucursal. No inventes destinatario.'],
      ['Jornada y GPS', 'Driving Day On empieza el turno y puede pedir ubicación. Off la corta. El permiso de iPhone es aparte: si lo niegas, la app sigue y el mapa no tendrá pin en vivo.'],
      ['Mapas', 'Open Maps abre Apple/Google Maps con la dirección real. El mapa de RouteHub dibuja paradas geocodificadas; sin señal no hay GPS de fondo.'],
      ['Avisos', 'Las notificaciones avisan rutas nuevas o cambios. Si las apagas aquí y siguen saliendo, ciérralas en Ajustes del iPhone → RouteHub.'],
      ['Camión e historial', 'Truck muestra el vehículo asignado y combustible/mantenimiento. History lista paradas ya cerradas del día, en orden.'],
      ['Cuenta', 'Usuario, sucursal y rol los pone tu empresa. Para login o un camión mal asignado habla con el manager, no desde esta pantalla.'],
    ]
  }
  if (locale === 'fr') {
    return [
      ['Today', 'Arrêt assigné : type (collecte, livraison, retour), adresse, contact et PO. Vide = pas encore de travail.'],
      ['Terminer un arrêt', 'Démarrez, Arrivé, puis terminer. Collecte : confirmez le matériel. Livraison : nom du destinataire, photo ou signature. Retour : succursale, sans PO.'],
      ['Incident', 'Client absent, mauvaise adresse ou dégât : Incident sur l’arrêt. Visible par la succursale.'],
      ['Journée et GPS', 'Driving Day On démarre le service et peut demander la position. Off l’arrête. Le permis iPhone est séparé.'],
      ['Cartes', 'Open Maps ouvre Plans/Google. RouteHub place les arrêts géocodés. Pas de GPS en arrière-plan.'],
      ['Alertes', 'Nouvelles routes et changements. Pour les couper vraiment : Réglages iPhone → RouteHub.'],
      ['Camion et historique', 'Truck = véhicule assigné. History = arrêts déjà terminés.'],
      ['Compte', 'Compte et rôle gérés par l’entreprise. Mot de passe / camion : votre manager.'],
    ]
  }
  return [
    ['Today', 'This is the assigned stop: type (pickup, delivery or return), address, contact and PO. Empty means the branch has not assigned work yet.'],
    ['How to finish a stop', 'Start the route, tap Arrived, then complete. Pickup: confirm you have the material. Delivery: recipient name plus a photo or signature. Return: arrive at the branch. No PO on return.'],
    ['Issue', 'Customer gone, wrong address or damaged goods: use Issue on the stop. It is stored for the branch. Do not invent a recipient name.'],
    ['Driving Day and GPS', 'Driving Day On starts the shift and may ask for location. Off stops sharing. iPhone permission is separate. If you deny it, you can still work; the live pin will not update.'],
    ['Maps', 'Open Maps hands the real address to Apple or Google Maps. The in-app map plots geocoded stops. This PWA cannot keep GPS running after you leave the app.'],
    ['Alerts', 'Device notifications are for new routes and changes. To silence them fully, also turn them off in iPhone Settings → RouteHub.'],
    ['Truck and History', 'Truck shows the assigned vehicle plus fuel and maintenance logs. History lists completed stops for the day, pickup then delivery then return.'],
    ['Account', 'Login, branch and role are set by your company. Password or wrong truck: talk to your manager. RouteHub Support does not change workspace access from this screen.'],
  ]
}

export default function DriverHelpPage() {
  const {locale, t} = useLocale()
  const title = locale === 'es' ? 'Ayuda' : locale === 'fr' ? 'Aide' : 'Help'
  const intro = locale === 'es'
    ? 'Guía de la app Driver. Los datos salen de las rutas que asigna tu sucursal.'
    : locale === 'fr'
      ? 'Guide de l’app Driver. Les données viennent des routes de votre succursale.'
      : 'Driver app guide. Everything here uses the routes your branch assigns.'

  return (
    <DriverV3Shell active="more" mode="stack" title={title} backHref="/driver/settings" backLabel={t.drvBack}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <p>ROUTEHUB DRIVER</p>
          <h1>{title}</h1>
        </header>
        <section className={styles.section}>
          <div className={styles.row}>
            <span className={styles.rowIcon}><CircleHelp size={18} /></span>
            <span className={styles.rowCopy}><strong>{title}</strong><small>{intro}</small></span>
          </div>
        </section>
        {topics(locale).map(([heading, body], index) => {
          const Icon = [Package, Navigation, MessageCircle, CalendarDays, MapPin, Bell, Truck, Shield][index] || CircleHelp
          return (
            <section key={heading} className={styles.section}>
              <div className={styles.row}>
                <span className={styles.rowIcon}><Icon size={18} /></span>
                <span className={styles.rowCopy}><strong>{heading}</strong><small>{body}</small></span>
              </div>
            </section>
          )
        })}
        <p className={styles.footer}>
          <Link href="/driver/privacy">{locale === 'es' ? 'Privacidad' : locale === 'fr' ? 'Confidentialité' : 'Privacy'}</Link>
          {' · '}
          <Link href="/terms">Terms</Link>
          {' · '}
          {DRIVER_APP_VERSION}
        </p>
      </div>
    </DriverV3Shell>
  )
}
