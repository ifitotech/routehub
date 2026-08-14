import type {Role} from './types'

export const temporaryExecutionRoles: Role[] = [
  'branch_manager',
  'operations_manager',
  'sales_representative',
  'counter_sales',
]

export const routeExecutionRoles: Role[] = ['driver', ...temporaryExecutionRoles]

export type Assignee = {user_id: string; role?: string | null}

export function isTemporaryRouteAssignee(role: string | null | undefined) {
  return Boolean(role && temporaryExecutionRoles.includes(role as Role))
}

export function chooseDefaultAssignee<T extends Assignee>(assignees: T[], primaryDriverId?: string | null) {
  return assignees.find(person => person.user_id === primaryDriverId && person.role === 'driver')
    || assignees.find(person => person.role === 'driver')
}

export type LocationFreshness = 'recent' | 'approximate' | 'last_known' | 'unavailable'

export function locationFreshness(updatedAt: string | null | undefined, now = Date.now()): LocationFreshness {
  if (!updatedAt) return 'unavailable'
  const timestamp = new Date(updatedAt).getTime()
  if (!Number.isFinite(timestamp)) return 'unavailable'
  const ageMinutes = Math.max(0, (now - timestamp) / 60_000)
  if (ageMinutes <= 5) return 'recent'
  if (ageMinutes <= 15) return 'approximate'
  return 'last_known'
}
