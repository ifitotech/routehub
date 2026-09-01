import type {MissionStatus} from './types'

/**
 * A route_date is an operational calendar date, not a UTC timestamp.  Use
 * the driver's local calendar to avoid moving tomorrow's work into today when
 * a UTC conversion crosses midnight.
 */
export function operationalDate(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export type DriverQueueRoute = {
  id: string
  driver_id?: string | null
  route_date?: string | null
  status: MissionStatus
  position: number
  completed_at?: string | null
}

export type DriverTodayQueue<T extends DriverQueueRoute> = {
  current: T | undefined
  upcoming: T[]
  completed: T[]
}

// Dispatch assigns routes with `assigned`; treat that state as actionable so
// Start Delivery can promote it to the active operation without disappearing
// on the next refresh.
const upcomingStatuses: MissionStatus[] = ['pending', 'published', 'assigned']

function ordered<T extends DriverQueueRoute>(routes: T[]) {
  return [...routes].sort((left, right) =>
    (left.route_date || '').localeCompare(right.route_date || '') ||
    left.position - right.position ||
    left.id.localeCompare(right.id),
  )
}

/**
 * Selects one driver's authoritative work queue for the local operational
 * date. A pending route from an earlier day is shown only when there is no
 * current work today, so unfinished work is never silently lost.
 */
export function selectDriverTodayQueue<T extends DriverQueueRoute>(
  routes: T[],
  driverId: string,
  today: string,
): DriverTodayQueue<T> {
  const driverRoutes = routes.filter(route => route.driver_id === driverId)
  const active = ordered(driverRoutes.filter(route => route.status === 'active' && (route.route_date || '') <= today))
  const paused = ordered(driverRoutes.filter(route => route.status === 'paused' && (route.route_date || '') <= today))
  const eligibleUpcoming = ordered(driverRoutes.filter(route => upcomingStatuses.includes(route.status) && (route.route_date || '') <= today))
  // If more than one carry-over route exists, resume the most recent
  // unfinished operational day first. Older work remains in the queue, but
  // it must not hide the latest pending delivery from the driver.
  const overdue = ordered(driverRoutes.filter(route => upcomingStatuses.includes(route.status) && (route.route_date || '') < today))
    .sort((left, right) =>
      (right.route_date || '').localeCompare(left.route_date || '') ||
      left.position - right.position ||
      left.id.localeCompare(right.id),
    )
  // Carry-over work has priority so an unfinished route left overnight is
  // the first operation the driver sees the next day.
  const current = overdue[0] ?? active[0] ?? paused[0] ?? eligibleUpcoming[0]

  return {
    current,
    upcoming: [...new Map([...overdue, ...eligibleUpcoming].filter(route => route.id !== current?.id).map(route => [route.id, route])).values()],
    completed: [...driverRoutes]
      .filter(route => route.status === 'completed')
      .sort((left, right) => (right.completed_at || '').localeCompare(left.completed_at || '') || left.position - right.position),
  }
}

export function canDriverStartRoute(route: DriverQueueRoute | undefined, today: string) {
  const routeDate = route?.route_date?.slice(0, 10) || ''
  return Boolean(route && routeDate <= today && [...upcomingStatuses, 'paused'].includes(route.status))
}
