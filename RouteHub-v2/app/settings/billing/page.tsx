'use client'

import {useLocale} from '../../../lib/use-preferences'
import {SettingsDoc} from '../settings-doc'

export default function SettingsBillingPage() {
  const {locale} = useLocale()
  if (locale === 'es') {
    return (
      <SettingsDoc
        title="Plan y facturación"
        intro="Estado del plan de esta empresa. El cobro lo ve el administrador de la cuenta."
        sections={[
          ['Plan actual', 'El plan (Free, trial o de pago) se guarda en la empresa, no en tu usuario.'],
          ['Trial', 'Si hay fecha de trial, esa es la fecha en que termina la prueba. Si vence, el administrador debe renovar.'],
          ['Qué cubre hoy', 'Rutas del día, mapa, contactos, equipo, camión, historial y Driver.'],
          ['Quién cambia el plan', 'Un administrador de la empresa o de la plataforma. Esta pantalla no cobra tarjetas.'],
          ['Soporte', 'Usa Contactar soporte en Ajustes. No envíes números de tarjeta.'],
        ]}
      />
    )
  }
  if (locale === 'fr') {
    return (
      <SettingsDoc
        title="Offre et facturation"
        intro="État de l’offre de cette entreprise."
        sections={[
          ['Offre', 'Liée à l’entreprise, pas à votre login.'],
          ['Essai', 'La date affichée est la fin de l’essai.'],
          ['Produit', 'Itinéraires, carte, contacts, équipe, camion, historique, Driver.'],
          ['Changement', 'Administrateur de l’entreprise ou de la plateforme.'],
          ['Support', 'Formulaire Support. Pas de numéro de carte.'],
        ]}
      />
    )
  }
  return (
    <SettingsDoc
      title="Plan and billing"
      intro="Plan status for this company. Charging is handled by the account administrator."
      sections={[
        ['Current plan', 'Plan (Free, trial or paid) is stored on the company, not on your login.'],
        ['Trial', 'If a trial date is shown, that is when this company trial ends. After it expires the administrator must renew.'],
        ['What ships today', 'Daily routes, operations map, contacts, team, truck, history and Driver.'],
        ['Who changes the plan', 'A company or platform administrator. This screen does not take cards.'],
        ['Billing support', 'Use Contact support in Settings. Do not send card numbers in that form.'],
      ]}
    />
  )
}
