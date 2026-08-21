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

const upcomingStatuses: MissionStatus[] = ['pending', 'published']

function ordered<T extends DriverQueueRoute>(routes: T[]) {
  return [...routes].sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
}

/**
 * Selects one driver's authoritative work queue for the local operational
 * date. Active work always wins; a paused route remains the current context
 * for today; only then can an upcoming route become current.
 */
export function selectDriverTodayQueue<T extends DriverQueueRoute>(
  routes: T[],
  driverId: string,
  today: string,
): DriverTodayQueue<T> {
  const todayRoutes = routes.filter(route => route.driver_id === driverId && route.route_date === today)
  const active = ordered(todayRoutes.filter(route => route.status === 'active'))
  const paused = ordered(todayRoutes.filter(route => route.status === 'paused'))
  const eligibleUpcoming = ordered(todayRoutes.filter(route => upcomingStatuses.includes(route.status)))
  const current = active[0] ?? paused[0] ?? eligibleUpcoming[0]

  return {
    current,
    upcoming: eligibleUpcoming.filter(route => route.id !== current?.id),
    completed: [...todayRoutes]
      .filter(route => route.status === 'completed')
      .sort((left, right) => (right.completed_at || '').localeCompare(left.completed_at || '') || left.position - right.position),
  }
}

export function canDriverStartRoute(route: DriverQueueRoute | undefined, today: string) {
  const routeDate = route?.route_date?.slice(0, 10)
  return Boolean(route && routeDate === today && [...upcomingStatuses, 'paused'].includes(route.status))
}
