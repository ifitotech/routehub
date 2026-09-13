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

// CEO-set suffix shared by every generated test password - a simple,
// memorable ending instead of a random string, since the whole point of
// a beta login is that the CEO can read it straight off the branch card
// and hand it to a tester without looking anything up. Change this if a
// different number is wanted; it only affects accounts created after the
// change, not ones that already exist.
export const BETA_PASSWORD_SUFFIX = '0169'

// Falls back to the first letter of each word in the company name (e.g.
// "City Electric Supply" -> "ces") when the CEO hasn't set an explicit
// abbreviation on the organization yet.
export function companyAbbreviation(company: {name: string; abbreviation?: string | null}) {
  if (company.abbreviation?.trim()) return slugify(company.abbreviation)
  const initials = company.name.trim().split(/\s+/).map(word => word[0] || '').join('').toLowerCase()
  return initials.slice(0, 4) || 'co'
}

// Deterministic instead of random - "cesopa0169" for City Electric
// Supply's Opa-locka branch - so the CEO can read a tester's password
// straight off the branch instead of having to store or look one up.
// Still just a starting value: the field that uses this stays editable.
export function betaAccountPassword(company: {name: string; abbreviation?: string | null}, branch: {name: string; branch_number?: string | null}) {
  const branchPart = slugify(branch.branch_number || branch.name).replace(/-/g, '').slice(0, 6)
  return `${companyAbbreviation(company)}${branchPart}${BETA_PASSWORD_SUFFIX}`
}
