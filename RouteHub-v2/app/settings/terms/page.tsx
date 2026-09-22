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
          ['Servicio y responsabilidades', 'RouteHub organiza trabajo; no es transportista, empleador, aseguradora ni servicio de emergencia. La empresa sigue siendo responsable de sus operaciones.'],
          ['Conducción segura', 'Respeta las leyes, usa un soporte o manos libres cuando corresponda y no interactúes con la app de forma que distraiga. Un mapa, ETA o aviso no sustituye tu criterio.'],
          ['Rutas y comprobantes', 'Pickup, Delivery o Return. Registra datos reales. Si no se puede completar, usa Issue: no inventes receptor, foto, firma ni resultado.'],
          ['Ubicación', 'Requiere Driving Day On y permiso del dispositivo. Android puede compartir una ubicación aproximada cada 8 minutos durante la sesión activa. Apagar Driving Day o retirar permiso detiene nuevos envíos; la PWA no sigue GPS cerrada.'],
          ['Mapas y avisos', 'Direcciones y coordenadas pueden ir a proveedores de mapas. Navegación externa sigue sus propios términos. Los avisos son opcionales y dependen del dispositivo.'],
          ['Datos y uso permitido', 'Los registros pertenecen al workspace de la empresa. No accedas a otro workspace, evadas roles, falsifiques datos ni subas contenido sin derecho a usarlo.'],
          ['Cambios y soporte', 'Una actualización material puede requerir una nueva aceptación. Soporte se envía desde Ajustes. Revisión legal: antes de usar estos términos como contrato comercial, añade entidad legal, dirección, ley aplicable y proceso de disputas.'],
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
          ['Service et responsabilités', 'RouteHub organise le travail ; ce n’est ni un transporteur, ni un employeur, ni un service d’urgence.'],
          ['Conduite sûre', 'Respectez la loi et n’utilisez pas l’application d’une manière qui détourne votre attention de la conduite.'],
          ['Itinéraires et preuves', 'Collecte, livraison ou retour. Enregistrez des informations exactes ; utilisez Incident au lieu d’inventer un résultat.'],
          ['Position', 'Nécessite Driving Day et la permission de l’appareil. Android peut envoyer une position approximative toutes les 8 minutes durant la session active.'],
          ['Cartes, données et mises à jour', 'Les adresses peuvent être envoyées aux fournisseurs de cartes. Les données appartiennent à l’entreprise. Une mise à jour importante peut demander une nouvelle acceptation.'],
        ]}
      />
    )
  }
  return (
    <SettingsDoc
      title="Terms of Use"
      intro="Rules for using Manager and Driver at work. This page describes the current product. It is not legal advice."
      sections={[
        ['Service and responsibility', 'RouteHub organizes work; it is not a carrier, employer, insurer or emergency service. The company remains responsible for its operations.'],
        ['Safe driving', 'Follow traffic law, use a mount or hands-free equipment where required, and do not use the app in a distracting way. A map, ETA or alert does not replace judgment.'],
        ['Routes and proof', 'Pickup, delivery or return. Record truthfully; use Issue instead of inventing a recipient, photo, signature or result.'],
        ['Location', 'Requires both Driving Day and device permission. Android may send an approximate location every 8 minutes during its active session. Turning Driving Day off or revoking permission stops new sharing; the PWA cannot track GPS after it is closed.'],
        ['Maps, data and updates', 'Addresses and coordinates may go to map providers. Workspace records belong to the company. A material update may require renewed acceptance.'],
      ]}
    />
  )
}
