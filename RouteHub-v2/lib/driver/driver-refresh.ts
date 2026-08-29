import {deriveCurrentOperation, deriveDriverQueue, type SharedDriverRoute, type SharedCurrentOperation} from './driver-selectors'

export type DriverOperationalSnapshot<T extends SharedDriverRoute = SharedDriverRoute> = {
  routes: T[]
  queue: ReturnType<typeof deriveDriverQueue<T>>
  currentOperation: SharedCurrentOperation<T> | null
}

/** Rebuilds all operational state from the freshly loaded authoritative rows. */
export function buildDriverSnapshot<T extends SharedDriverRoute>(routes: T[], driverId: string, today: string): DriverOperationalSnapshot<T> {
  return {routes, queue: deriveDriverQueue(routes, driverId, today), currentOperation: deriveCurrentOperation(routes, driverId, today)}
}

export async function refreshDriverSnapshot<T extends SharedDriverRoute>(loadRoutes: () => Promise<T[]>, driverId: string, today: string) {
  return buildDriverSnapshot(await loadRoutes(), driverId, today)
}
