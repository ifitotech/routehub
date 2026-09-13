import type {Role} from './types'

// Shared helpers for Admin's "create a working @routehub.local login"
// shortcut - used both when creating a new beta-tester company and when
// adding an extra test user (any role) to a branch that already exists.
export function slugify(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'company'
}

// Short, stable identifiers for the email itself - "hialeah.manager@..."
// instead of spelling out the full company + branch + role label, which
// got long fast once a branch had all five roles.
export const roleSlug: Record<Role, string> = {
  ceo: 'ceo',
  branch_manager: 'manager',
  operations_manager: 'operations',
  sales_representative: 'sales',
  counter_sales: 'counter',
  driver: 'driver',
}

// Emails are keyed off the branch alone (code if it has one, else the
// name) plus the role - short, and the branch is readable directly from
// the login itself instead of only being visible once signed in.
export function betaAccountEmail(branch: {name: string; branch_number?: string | null}, role: Role) {
  return `${slugify(branch.branch_number || branch.name)}.${roleSlug[role]}@routehub.local`
}

export function randomPassword() {
  // Readable-enough to copy by hand, random enough not to matter that it's a
  // test account - the tester can change it from Settings right after.
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 12)
}
