import {selectDriverTodayQueue, type DriverQueueRoute} from '../driver-queue'
import {orderedStops, stopKind, type WorkflowStop} from '../stop-workflow'

export type SharedDriverRoute = DriverQueueRoute & WorkflowStop & {
  mission_type?: string | null
  route_date?: string | null
  destination_address?: string | null
  destination_lat?: number | null
  destination_lng?: number | null
}

export type SharedCurrentOperation<T extends SharedDriverRoute = SharedDriverRoute> = {
  route: T
  kind: ReturnType<typeof stopKind>
  total: number
  completed: number
  remaining: number
}

/** Single authoritative current-operation derivation for Driver surfaces. */
export function deriveCurrentOperation<T extends SharedDriverRoute>(routes: T[], driverId: string, today: string): SharedCurrentOperation<T> | null {
  const queue = selectDriverTodayQueue(routes, driverId, today)
  if (!queue.current) return null
  const operationDate = queue.current.route_date?.slice(0, 10) || today
  const ordered = orderedStops(routes.filter(route => route.route_date?.slice(0, 10) === operationDate))
  const required = ordered.filter(route => route.status !== 'cancelled')
  const completed = required.filter(route => ['completed', 'cancelled'].includes(route.status)).length
  return {route: queue.current, kind: stopKind(queue.current.mission_type), total: required.length, completed, remaining: Math.max(0, required.length - completed)}
}

export function deriveDriverQueue<T extends SharedDriverRoute>(routes: T[], driverId: string, today: string) {
  return selectDriverTodayQueue(routes, driverId, today)
}
