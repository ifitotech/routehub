import type {Locale} from './i18n'
import type {Role} from './types'

/** Canonical permissions stay stable; these labels are presentation only. */
export const roleOptions: Role[] = ['branch_manager','operations_manager','sales_representative','counter_sales','driver']

const labels: Record<Locale, Record<Role, string>> = {
  en: {ceo:'CEO / Admin', branch_manager:'Branch Manager', operations_manager:'Operations Manager', sales_representative:'Sales Representative', counter_sales:'Counter Sales', driver:'Driver'},
  es: {ceo:'CEO / Administrador', branch_manager:'Gerente de sucursal', operations_manager:'Gerente de operaciones', sales_representative:'Representante de ventas', counter_sales:'Ventas de mostrador', driver:'Conductor'},
  fr: {ceo:'PDG / Administrateur', branch_manager:'Responsable de succursale', operations_manager:'Responsable des opérations', sales_representative:'Représentant commercial', counter_sales:'Ventes au comptoir', driver:'Conducteur'}
}

export function roleLabel(role: Role, locale: Locale = 'en') {
  return labels[locale][role] || labels.en[role] || role
}

export function roleLabelOptions(locale: Locale = 'en') {
  return roleOptions.map(role => ({role, label: roleLabel(role, locale)}))
}
