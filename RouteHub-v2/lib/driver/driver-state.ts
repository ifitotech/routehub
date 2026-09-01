import {stopAction, stopKind, type StopKind, type WorkflowStop} from '../stop-workflow'

export type DriverOperationPhase = 'pending' | 'started' | 'arrived' | 'completed' | 'issue'
export type DriverNextAction = 'start_route' | 'arrived' | 'confirm_pickup' | 'complete_delivery' | 'complete_return' | 'review_issue' | 'none'

/** Derives the driver's operational phase from persisted fields only. */
export function driverOperationPhase(route: WorkflowStop & {route_started_at?: string | null; arrived_at?: string | null}): DriverOperationPhase {
  if (route.status === 'issue') return 'issue'
  if (route.status === 'completed' || Boolean(route.completed_at || route.finalized_at)) return 'completed'
  if (route.arrived_at) return 'arrived'
  if (route.status === 'active' || route.status === 'paused' || route.route_started_at) return 'started'
  return 'pending'
}

/** Maps the phase to one unambiguous action label for every Driver surface. */
export function driverNextAction(route: WorkflowStop & {route_started_at?: string | null; arrived_at?: string | null}, kind: StopKind = stopKind(route.mission_type)): DriverNextAction {
  const phase = driverOperationPhase(route)
  if (phase === 'issue') return 'review_issue'
  if (phase === 'completed') return 'none'
  if (phase === 'pending') return 'start_route'
  const action = stopAction(kind, phase === 'arrived')
  if (action === 'arrived') return 'arrived'
  if (action === 'confirm_pickup') return 'confirm_pickup'
  if (action === 'complete_delivery') return 'complete_delivery'
  return 'complete_return'
}
