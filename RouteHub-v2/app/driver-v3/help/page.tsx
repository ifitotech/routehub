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
import {USER_GUIDE_URL} from '../../../lib/user-guide'
import styles from '../driver-preferences.module.css'

function topics(locale: string) {
  if (locale === 'es') {
    return [
      ['Hoy',
        'Hoy es la parada que te toca ahora. Arriba ves el mapa de la ruta. Abajo la ficha: tipo (Pickup, Delivery o Return), dirección, contacto y, si es recogida, el PO. Vacío significa que la sucursal todavía no te asignó trabajo para hoy.'],
      ['Cómo completar',
        'En la ficha usas Maps para abrir la navegación del teléfono. Al llegar, desliza o confirma llegada. Se abre una hoja sobre Hoy: Pickup pide confirmar que llevas el material; Delivery pide el nombre de quien recibe y una foto; Return es llegar a la sucursal, sin PO. Issue si no se puede entregar.'],
      ['Issue',
        'Cliente ausente, dirección mala o daño: Issue en esa parada. Queda en el historial para la sucursal. No inventes un destinatario solo para cerrar la entrega.'],
      ['Jornada y GPS',
        'Driving Day On empieza el turno. Off lo cierra. El permiso de ubicación del iPhone o Android es otro interruptor. Si lo niegas, puedes trabajar; el pin en vivo no se mueve. Esta PWA no sigue el GPS con la app cerrada.'],
      ['Mapas',
        'Maps entrega la dirección real a Apple o Google Maps. El mapa de RouteHub dibuja las paradas que ya tienen coordenada. Sin señal no hay ruta dibujada.'],
      ['Avisos',
        'La campana del encabezado y el interruptor de Ajustes avisan rutas nuevas o cambios. Si las apagas aquí y siguen saliendo, ciérralas también en Ajustes del teléfono → RouteHub.'],
      ['Camión e historial',
        'Camión muestra el vehículo asignado. Historial lista las paradas ya cerradas del día, en orden: recogida, entrega, retorno.'],
      ['Cuenta y legal',
        'Usuario, sucursal y rol los pone tu empresa. Contraseña o camión mal asignado: habla con el manager. Privacidad y Términos están en Ajustes. La guía larga se abre desde Ajustes → Guía de uso.'],
    ]
  }
  if (locale === 'fr') {
    return [
      ['Aujourd’hui', 'Carte en haut, fiche en bas : type (collecte, livraison, retour), adresse, contact et PO si collecte. Vide = pas encore de travail.'],
      ['Terminer un arrêt', 'Maps ouvre la navigation du téléphone. À l’arrivée, confirmez. Collecte : confirmez le matériel. Livraison : nom du destinataire et photo. Retour : succursale, sans PO. Incident si c’est impossible.'],
      ['Incident', 'Client absent, mauvaise adresse ou dégât : Incident. Visible par la succursale. N’inventez pas de destinataire.'],
      ['Journée et GPS', 'Driving Day On démarre le service. Le permis de l’appareil est séparé. Pas de GPS appli fermée.'],
      ['Cartes', 'Maps ouvre Plans/Google. RouteHub place les arrêts géocodés.'],
      ['Alertes', 'Cloche et réglage Ajustes. Pour tout couper : Réglages du téléphone → RouteHub.'],
      ['Camion et historique', 'Camion = véhicule assigné. Historique = arrêts déjà terminés.'],
      ['Compte', 'Compte et rôle gérés par l’entreprise. Confidentialité et Conditions dans Ajustes.'],
    ]
  }
  return [
    ['Today',
      'Today is the stop in front of you. The map sits on top. The sheet underneath shows type (Pickup, Delivery or Return), address, contact and the PO on pickup. Empty means the branch has not assigned work for today.'],
    ['How to finish a stop',
      'Use Maps to hand the real address to Apple or Google Maps. When you get there, slide or confirm arrival. A sheet opens on Today: Pickup asks you to confirm the material; Delivery asks for the recipient name and a photo; Return is arrive at the branch with no PO. Use Issue if the stop cannot be finished.'],
    ['Issue',
      'Customer gone, bad address or damaged goods: Issue on that stop. It is stored for the branch. Do not invent a recipient name just to close a delivery.'],
    ['Driving Day and GPS',
      'Driving Day On starts the shift. Off ends it. Phone location permission is a separate switch. If you deny it you can still work; the live pin will not move. This PWA cannot keep GPS running after you leave the app.'],
    ['Maps',
      'Maps opens the phone navigation app with the real address. The RouteHub map plots stops that already have coordinates. No signal means no drawn line.'],
    ['Alerts',
      'The header bell and the Settings toggle send new-route and change alerts. If you turn them Off here and they still appear, also disable them in the phone Settings app → RouteHub.'],
    ['Truck and History',
      'Truck shows the assigned vehicle. History lists closed stops for the day in order: pickup, then delivery, then return.'],
    ['Account and legal',
      'Login, branch and role are set by your company. Password or wrong truck: talk to your manager. Privacy and Terms live in Settings. The long walkthrough is Settings → User guide.'],
  ]
}

export default function DriverHelpPage() {
  const {locale, t} = useLocale()
  const title = locale === 'es' ? 'Ayuda' : locale === 'fr' ? 'Aide' : 'Help'
  const intro = locale === 'es'
    ? 'Guía corta de Driver. Los datos salen de las rutas que asigna tu sucursal.'
    : locale === 'fr'
      ? 'Guide court du Driver. Les données viennent des routes de votre succursale.'
      : 'Short Driver guide. Everything here uses the routes your branch assigns.'

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
          <Link href="/terms">{locale === 'es' ? 'Términos' : locale === 'fr' ? 'Conditions' : 'Terms'}</Link>
          {' · '}
          <a href={USER_GUIDE_URL} target="_blank" rel="noreferrer">{locale === 'es' ? 'Guía' : locale === 'fr' ? 'Guide' : 'Guide'}</a>
          {' · '}
          {DRIVER_APP_VERSION}
        </p>
      </div>
    </DriverV3Shell>
  )
}
