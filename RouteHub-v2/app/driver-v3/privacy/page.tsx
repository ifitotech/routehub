'use client'
import Link from 'next/link'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useLocale} from '../../../lib/use-preferences'
import styles from '../driver-preferences.module.css'

function sections(locale: string) {
  if (locale === 'es') {
    return [
      ['Quién controla los datos', 'Tu empresa es dueña del espacio RouteHub. El administrador decide quién entra, qué rutas se asignan y cuánto tiempo se guardan. RouteHub solo opera el software.'],
      ['Cuenta', 'Guardamos nombre, correo y teléfono del perfil, más rol y sucursal que asignó la empresa. El acceso lo gestiona el proveedor de inicio de sesión del workspace.'],
      ['Ubicación', 'Se usa después de encender Driving Day y de que el teléfono conceda el permiso. Sirve para que la sucursal vea la ruta en vivo. Al apagar Driving Day se deja de enviar. Esta PWA no puede leer GPS con la app cerrada. Puedes quitar el permiso en Ajustes del sistema.'],
      ['Rutas y evidencia', 'Las paradas pueden incluir dirección, contacto, teléfono, PO, notas, fotos, firmas, nombre de quien recibe y reportes Issue. Sube solo lo que pide esa parada.'],
      ['Notificaciones', 'Si las activas, el navegador guarda una suscripción push (VAPID) para avisos de rutas nuevas o cambios. Puedes dejarlas Off. Para silenciarlas del todo usa también Ajustes del iPhone.'],
      ['Mapas', 'Las direcciones se envían a geocodificación (Google, y si falla Census/Nominatim) y al enrutado para dibujar el mapa. Esos servicios reciben la dirección, no tu contraseña.'],
      ['Retención y acceso', 'Ven lo que permite el rol. Borrado y archivo los decide el administrador de la empresa. Preguntas de cuenta: tu manager. Términos: /terms.'],
    ]
  }
  if (locale === 'fr') {
    return [
      ['Qui contrôle les données', 'Votre entreprise possède l’espace RouteHub. L’administrateur choisit les accès et les routes. RouteHub fournit le logiciel.'],
      ['Compte', 'Nom, e-mail, téléphone du profil, rôle et succursale assignés par l’entreprise.'],
      ['Position', 'Collectée après Driving Day On et l’autorisation de l’appareil. Arrêtée quand la journée se termine. Pas de GPS appli fermée.'],
      ['Routes et preuves', 'Adresses, contacts, PO, notes, photos, signatures, destinataire et incidents.'],
      ['Notifications', 'Abonnement push du navigateur pour nouvelles routes. Vous pouvez les laisser Off.'],
      ['Cartes', 'Adresses envoyées au géocodage (Google, sinon Census/Nominatim) pour placer les arrêts. Pas de mot de passe.'],
      ['Conservation', 'Selon le rôle. Suppression : administrateur. Conditions : /terms.'],
    ]
  }
  return [
    ['Who controls the data', 'Your company owns the RouteHub workspace. Administrators decide who can sign in, which routes are assigned and how long records are kept. RouteHub provides the software; the company sets workplace policy.'],
    ['Account', 'We store the name, email and phone saved on your profile, plus the role and branch your company assigned. Sign-in is handled by the authentication provider for this workspace.'],
    ['Location', 'Collected only after Driving Day is On and the device grants permission. Used so the branch can see the live route during that work period. Ending Driving Day stops sharing. This web PWA cannot read GPS after you leave the app. You can withdraw permission in system Settings.'],
    ['Routes and proof', 'Assigned stops may include address, contact name, phone, PO / order number, notes, photos, signatures, recipient name and Issue reports. Upload only what that stop requires.'],
    ['Notifications', 'If you turn alerts On, this browser stores a VAPID push subscription for new-route and route-change messages. You can leave them Off. iPhone Settings → RouteHub is also required to silence them fully.'],
    ['Maps', 'Addresses may be sent to geocoding and routing providers (Google first, then Census and Nominatim if Google is empty) so the map can place stops. Those providers receive the address string, not your login.'],
    ['Access and retention', 'Access follows workspace roles. Retention and deletion are handled by the company administrator. Account questions go to your manager. Product terms: /terms. This page describes the current beta; it is not legal advice.'],
  ]
}

export default function DriverPrivacyPage() {
  const {locale, t} = useLocale()
  const title = locale === 'es' ? 'Privacidad' : locale === 'fr' ? 'Confidentialité' : 'Privacy Policy'
  return (
    <DriverV3Shell active="more" mode="stack" title={title} backHref="/driver/settings" backLabel={t.drvBack}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <p>ROUTEHUB</p>
          <h1>{title}</h1>
        </header>
        {sections(locale).map(([heading, body]) => (
          <section key={heading} className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>{heading}</h2>
              <p>{body}</p>
            </div>
          </section>
        ))}
        <p className={styles.footer}>
          <Link href="/terms">Terms of Use</Link>
          {' · '}
          September 2, 2026
        </p>
      </div>
    </DriverV3Shell>
  )
}
