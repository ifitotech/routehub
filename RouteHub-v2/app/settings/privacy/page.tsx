'use client'

import {useLocale} from '../../../lib/use-preferences'
import {SettingsDoc} from '../settings-doc'

export default function SettingsPrivacyPage() {
  const {locale} = useLocale()
  if (locale === 'es') {
    return (
      <SettingsDoc
        title="Privacidad"
        intro="Qué guarda RouteHub cuando usas Manager. Describe el producto de hoy. No es asesoría legal."
        sections={[
          ['Quién controla el espacio', 'La empresa que te invitó es dueña del workspace. Ella decide quién entra, qué rutas existen y cuánto tiempo se guardan. RouteHub opera el software.'],
          ['Cuenta', 'Guardamos nombre, correo, teléfono y foto del perfil, más el rol y la sucursal que asignó la empresa. Las cuentas @routehub.local las controla el administrador.'],
          ['Rutas y contactos', 'Una parada puede llevar dirección, contacto, teléfono, PO, notas, nombre de quien recibe, fotos e incidencias. Eso pertenece a la empresa.'],
          ['Mapas', 'La dirección se envía a geocodificación (Google primero; si viene vacío, Census o Nominatim) para pintar el mapa. Reciben la dirección, no la contraseña.'],
          ['Notificaciones', 'Si activas avisos, el navegador guarda una suscripción push. Puedes dejarlos apagados.'],
          ['Soporte', 'El formulario de Soporte en Ajustes crea un pedido real. No pongas contraseñas ni datos de tarjeta.'],
          ['Dónde vive', 'La app corre en Vercel. Los datos están en Supabase. Mapas pueden usar Google y un fallback público.'],
          ['Acceso y borrado', 'Exportar o borrar registros de la empresa lo hace el administrador. Para tu login usa Ajustes.'],
          ['Menores', 'RouteHub es una herramienta de trabajo. No está dirigida a menores de 16 años.'],
        ]}
      />
    )
  }
  if (locale === 'fr') {
    return (
      <SettingsDoc
        title="Confidentialité"
        intro="Ce que RouteHub conserve dans Manager. Description du produit actuel, pas un avis juridique."
        sections={[
          ['Espace de travail', 'L’entreprise qui vous a invité possède l’espace. RouteHub fournit le logiciel.'],
          ['Compte', 'Nom, e-mail, téléphone, photo, rôle et succursale. Comptes @routehub.local gérés par l’admin.'],
          ['Itinéraires', 'Adresses, contacts, PO, notes, photos et incidents appartiennent à l’entreprise.'],
          ['Cartes', 'Adresse envoyée à Google, puis Census ou Nominatim. Pas le mot de passe.'],
          ['Notifications', 'Les alertes push sont optionnelles.'],
          ['Support', 'Le formulaire Support crée une vraie demande.'],
          ['Hébergement', 'Vercel, Supabase, cartes Google / repli public.'],
          ['Accès', 'L’administrateur gère export et suppression.'],
          ['Mineurs', 'Outil professionnel, pas destiné aux moins de 16 ans.'],
        ]}
      />
    )
  }
  return (
    <SettingsDoc
      title="Privacy"
      intro="What RouteHub stores when you use Manager. This describes the product as it ships today. It is not legal advice."
      sections={[
        ['Who owns the workspace', 'The company that invited you owns the RouteHub workspace. That company decides who can sign in, which routes exist and how long records stay. RouteHub operates the software.'],
        ['Account', 'We store the name, email and phone saved on the profile, the avatar if one is uploaded, plus the role and branch the company assigned. Accounts ending in @routehub.local are test logins managed by the company.'],
        ['Routes and contacts', 'Stops may include addresses, contact names, phones, PO / order number, notes, recipient name, photos and Issue reports. Those records belong to the company workspace.'],
        ['Maps', 'Addresses may be sent to geocoding providers (Google first; Census or Nominatim if Google returns empty). Those providers receive the address, not the password.'],
        ['Notifications', 'If alerts are enabled, the browser stores a push subscription. Alerts can stay Off.'],
        ['Support', 'The Support form in Settings writes a real workspace request. Do not put passwords or card numbers in those messages.'],
        ['Hosting', 'The product is hosted on Vercel. Workspace data is stored in Supabase. Maps may use Google and public fallbacks.'],
        ['Access and deletion', 'Retention, export and deletion of company records are handled by the company administrator. For your own login, use Settings.'],
        ['Children', 'RouteHub is a workplace tool. It is not directed at children under 16.'],
      ]}
    />
  )
}
