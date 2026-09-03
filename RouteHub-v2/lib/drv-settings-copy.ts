import type {Locale} from './i18n'

export function settingsCopy(locale: Locale) {
  if (locale === 'es') {
    return {
      on: 'On',
      off: 'Off',
      alerts: 'Avisos',
      deviceNotifications: 'Notificaciones del dispositivo',
      notificationsHelp: 'Rutas nuevas y cambios aunque la app esté cerrada.',
      notificationsOn: 'Este dispositivo recibirá avisos de rutas.',
      notificationsOffHelp: 'Apágalas en Ajustes de iPhone → RouteHub si siguen activas.',
      shareLocation: 'Compartir ubicación',
      terms: 'Términos de uso',
      privacy: 'Política de privacidad',
      appearance: 'Tema de la app',
      versionLabel: 'Versión',
    }
  }
  if (locale === 'fr') {
    return {
      on: 'On',
      off: 'Off',
      alerts: 'Alertes',
      deviceNotifications: 'Notifications de l’appareil',
      notificationsHelp: 'Nouveaux itinéraires et changements même si l’app est fermée.',
      notificationsOn: 'Cet appareil recevra les alertes de routes.',
      notificationsOffHelp: 'Désactivez-les dans Réglages iPhone → RouteHub si elles restent actives.',
      shareLocation: 'Partager la position',
      terms: 'Conditions d’utilisation',
      privacy: 'Politique de confidentialité',
      appearance: 'Thème de l’app',
      versionLabel: 'Version',
    }
  }
  return {
    on: 'On',
    off: 'Off',
    alerts: 'Alerts',
    deviceNotifications: 'Device notifications',
    notificationsHelp: 'New routes and changes even when the app is closed.',
    notificationsOn: 'This device will receive route alerts.',
    notificationsOffHelp: 'Turn notifications off in iPhone Settings → RouteHub if they stay on.',
    shareLocation: 'Share location',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    appearance: 'App theme',
    versionLabel: 'Version',
  }
}
