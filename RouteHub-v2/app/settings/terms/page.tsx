'use client'

import {useLocale} from '../../../lib/use-preferences'
import {SettingsDoc} from '../settings-doc'

export default function SettingsTermsPage() {
  const {locale} = useLocale()
  if (locale === 'es') {
    return (
      <SettingsDoc
        title="Términos de uso"
        intro="Reglas para usar Manager y Driver en el trabajo. Describe el producto actual. No es asesoría legal."
        sections={[
          ['El servicio', 'RouteHub sirve para planear paradas, asignar conductores, seguir el día y guardar el registro. No es transportista ni empleador.'],
          ['Cuentas', 'Cada empresa es dueña de su workspace. Las cuentas @routehub.local no cambian la contraseña desde Ajustes.'],
          ['Uso permitido', 'Solo trabajo autorizado. No inventes paradas ni entres a otro workspace.'],
          ['Rutas', 'Pickup, Delivery o Return. PO solo en Pickup. Si no se puede cerrar, el driver marca Issue.'],
          ['Ubicación', 'Driving Day es distinto del permiso del teléfono. La PWA no sigue el GPS con la app cerrada.'],
          ['Mapas y avisos', 'Las direcciones pueden ir a proveedores de mapa. Los avisos son opcionales.'],
          ['Disponibilidad', 'No uses el mapa o un aviso como única fuente para una decisión de seguridad.'],
          ['Datos y plan', 'Rutas, contactos y fotos pertenecen a la empresa.'],
          ['Cambios', 'Si el producto cambia, actualizamos esta página. Soporte se envía desde Ajustes.'],
        ]}
      />
    )
  }
  if (locale === 'fr') {
    return (
      <SettingsDoc
        title="Conditions d’utilisation"
        intro="Règles d’usage de Manager et Driver. Description du produit, pas un avis juridique."
        sections={[
          ['Service', 'RouteHub planifie des arrêts et suit la journée. Ce n’est pas un transporteur.'],
          ['Comptes', 'L’entreprise possède l’espace. Comptes @routehub.local gérés par l’admin.'],
          ['Usage', 'Travail autorisé seulement.'],
          ['Itinéraires', 'Collecte, livraison ou retour. PO seulement à la collecte.'],
          ['Position', 'Driving Day ≠ permission du téléphone.'],
          ['Cartes', 'Adresses envoyées aux fournisseurs de carte.'],
          ['Disponibilité', 'Pas une source unique de sécurité.'],
          ['Données', 'Les enregistrements appartiennent à l’entreprise.'],
          ['Modifs', 'Cette page suit le produit.'],
        ]}
      />
    )
  }
  return (
    <SettingsDoc
      title="Terms of Use"
      intro="Rules for using Manager and Driver at work. This page describes the current product. It is not legal advice."
      sections={[
        ['The service', 'RouteHub is workplace software to plan stops, assign drivers and keep a record of each stop. It is not a carrier, employer or insurer.'],
        ['Accounts', 'Each company owns its workspace. Test logins ending in @routehub.local cannot change their password from Settings.'],
        ['Acceptable use', 'Use RouteHub only for authorized company work. Do not invent stop records or open another workspace.'],
        ['Routes', 'Pickup, delivery or return to branch. PO is pickup only. If a stop cannot close, the driver marks Issue.'],
        ['Location', 'Driving Day is separate from the phone location permission. The PWA cannot keep GPS after the Driver app is closed.'],
        ['Maps and alerts', 'Addresses may be sent to map providers. Device notifications are optional.'],
        ['Availability', 'Do not treat the map or a push alert as the only source for a safety-critical decision.'],
        ['Company data', 'Route records, contacts and photos belong to the company workspace.'],
        ['Changes', 'This page is updated when the product changes. Support is the form inside Settings.'],
      ]}
    />
  )
}
