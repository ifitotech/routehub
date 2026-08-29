import type {CurrentOperation, DriverV3Route} from './types'
import {deriveCurrentOperation as deriveSharedCurrentOperation, type SharedDriverRoute} from '../driver/driver-selectors'

export function deriveCurrentOperation(routes: DriverV3Route[], driverId: string, today: string): CurrentOperation | null {
  const current = deriveSharedCurrentOperation(routes as (DriverV3Route & SharedDriverRoute)[], driverId, today)
  return current && {route: current.route, kind: current.kind, total: current.total, completed: current.completed}
}
