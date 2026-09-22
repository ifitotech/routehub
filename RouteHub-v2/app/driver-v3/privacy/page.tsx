'use client'
import Link from 'next/link'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useLocale} from '../../../lib/use-preferences'
import {USER_GUIDE_URL} from '../../../lib/user-guide'
import styles from '../driver-preferences.module.css'

function sections(locale: string) {
  if (locale === 'es') {
    return [
      ['Quién controla los datos', 'Tu empresa es dueña del espacio RouteHub. El administrador decide quién entra, qué rutas se asignan y cuánto tiempo se guardan. RouteHub opera el software.'],
      ['Cuenta', 'Guardamos nombre, correo, teléfono y foto de perfil si la subes, más rol y sucursal. Las cuentas @routehub.local las controla el administrador.'],
      ['Ubicación', 'Cuando Driving Day está encendido y autorizas el permiso del teléfono, el APK Android comparte una posición aproximada cada 8 minutos para que tu empresa tenga una referencia operativa de la ruta. Se detiene al apagar Driving Day o retirar el permiso. La PWA no lee GPS con la app cerrada.'],
      ['Rutas y evidencia', 'Paradas: dirección, contacto, teléfono, PO en Pickup, notas, foto, nombre de quien recibe e Issue. Sube solo lo de esa parada.'],
      ['Notificaciones', 'Si las activas, el aparato guarda una suscripción push. Puedes dejarlas Off. Para silenciarlas del todo usa también Ajustes del teléfono.'],
      ['Mapas', 'Las direcciones van a geocodificación (Google, y si falla un fallback público) para dibujar el mapa. Reciben la dirección, no tu contraseña.'],
      ['Soporte y fallos', 'El formulario de Ajustes guarda un pedido de soporte. Los fallos de la app se pueden registrar para reparar el producto. No escribas contraseñas ahí.'],
      ['Retención', 'Ves lo que permite tu rol. Borrado y archivo: administrador de la empresa. Términos en /terms.'],
    ]
  }
  if (locale === 'fr') {
    return [
      ['Qui contrôle les données', 'Votre entreprise possède l’espace. RouteHub fournit le logiciel.'],
      ['Compte', 'Nom, e-mail, téléphone, photo, rôle et succursale. Comptes @routehub.local : administrateur.'],
      ['Position', 'Quand Driving Day est activé et que vous autorisez la permission, l’application Android partage une position approximative toutes les 8 minutes pour le suivi opérationnel de la tournée. Le partage s’arrête en désactivant Driving Day ou la permission. La PWA ne lit pas le GPS fermée.'],
      ['Routes et preuves', 'Adresses, contacts, PO à la collecte, notes, photos, destinataire et incidents.'],
      ['Notifications', 'Abonnement push facultatif. Coupure complète aussi dans les Réglages du téléphone.'],
      ['Cartes', 'Adresses envoyées au géocodage. Pas de mot de passe.'],
      ['Support', 'Le formulaire Réglages enregistre une demande. N’y mettez pas de mot de passe.'],
      ['Conservation', 'Selon le rôle. Suppression : administrateur. Conditions : /terms.'],
    ]
  }
  return [
    ['Who controls the data', 'Your company owns the RouteHub workspace. Administrators decide who can sign in, which routes are assigned and how long records are kept. RouteHub provides the software.'],
    ['Account', 'We store the name, email, phone and profile photo you save, plus the role and branch the company assigned. Logins ending in @routehub.local are managed by the company administrator.'],
    ['Location', 'When Driving Day is On and you grant device permission, the Android app shares an approximate location every 8 minutes so your company can coordinate routes. Sharing stops when Driving Day is turned Off or permission is revoked. The PWA cannot read GPS after you leave the app.'],
    ['Routes and proof', 'Stops may include address, contact, phone, pickup PO, notes, photos, recipient name and Issue reports. Upload only what that stop requires.'],
    ['Notifications', 'If alerts are On, the device stores a push subscription for new or changed routes. You can leave them Off. The phone Settings app is also required to silence them fully.'],
    ['Maps', 'Addresses may be sent to geocoding (Google first, then a public fallback) so the map can place stops. Providers receive the address, not your password.'],
    ['Support and faults', 'The Settings support form stores a request for your workspace. App faults may be logged so the product can be fixed. Do not put passwords in those messages.'],
    ['Access and retention', 'Access follows your role. Retention and deletion are handled by the company administrator. Product terms: /terms. This page describes the current product; it is not legal advice.'],
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
          <Link href="/terms">{locale === 'es' ? 'Términos de uso' : locale === 'fr' ? 'Conditions d’utilisation' : 'Terms of Use'}</Link>
          {' · '}
          <a href={USER_GUIDE_URL} target="_blank" rel="noreferrer">Guide</a>
          {' · '}
          September 21, 2026
        </p>
      </div>
    </DriverV3Shell>
  )
}
