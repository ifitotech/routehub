'use client'

import {useLocale} from '../../../lib/use-preferences'
import {SettingsDoc} from '../settings-doc'

export default function SettingsHelpPage() {
  const {locale} = useLocale()
  if (locale === 'es') {
    return (
      <SettingsDoc
        title="Ayuda"
        intro="Cómo está armado Manager hoy. Esto no cambia la lógica de las rutas."
        sections={[
          ['Dashboard', 'Calendario + lista del día + mapa de hoy. Mañana puede salir en la lista; el mapa solo dibuja el día abierto.'],
          ['Añadir ruta', 'Está dentro de Rutas, no es una ventana suelta. PO solo en Pickup. Delivery no muestra PO de recogida. Return usa la sucursal.'],
          ['Manejar rutas', 'Misma página. Subir, bajar o cancelar solo lo que no está activo o cerrado.'],
          ['Contactos y equipo', 'Contactos de la sucursal. Si falta la dirección de la sucursal, Ajustes te pide completarla antes de crear rutas.'],
          ['Camión e historial', 'Camión es el vehículo. Reportes e historial juntan conteos y paradas ya cerradas.'],
          ['Esta pantalla', 'Perfil, idioma, tema, notificaciones, sucursal, guía, privacidad, términos y soporte real.'],
        ]}
      />
    )
  }
  if (locale === 'fr') {
    return (
      <SettingsDoc
        title="Aide"
        intro="Organisation actuelle de Manager."
        sections={[
          ['Tableau de bord', 'Calendrier, liste et carte du jour.'],
          ['Nouvelle route', 'Dans Itinéraires. PO seulement à la collecte.'],
          ['Gérer', 'Même page. Arrêts encore ouverts seulement.'],
          ['Contacts', 'Contacts et équipe de la succursale.'],
          ['Camion', 'Véhicule et historique.'],
          ['Réglages', 'Profil, langue, thème, guide, confidentialité.'],
        ]}
      />
    )
  }
  return (
    <SettingsDoc
      title="Help"
      intro="How Manager is organized today. This page does not change route logic."
      sections={[
        ['Dashboard', 'Calendar plus today list and the map of today stops. Tomorrow can stay in the list; the map draws the open day only.'],
        ['Add route', 'Lives inside Routes. It is not a separate popup. PO on Pickup only. Delivery does not show a pickup PO.'],
        ['Manage routes', 'Same page. Move or cancel only stops that are not active or completed.'],
        ['Contacts and team', 'Branch contacts. A branch without an address is completed in Settings before you create routes.'],
        ['Truck and history', 'Truck is the branch vehicle. Reports and History hold counts and closed stops.'],
        ['This screen', 'Profile, language, theme, notifications, branch, guide, privacy, terms and the real Support form.'],
      ]}
    />
  )
}
