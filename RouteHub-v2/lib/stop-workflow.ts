export type StopKind = 'pickup' | 'delivery' | 'branch'
export type StopStatus = 'draft' | 'pending' | 'published' | 'active' | 'paused' | 'completed' | 'issue' | 'cancelled'

export type WorkflowStop = {
  id: string
  position: number
  status: StopStatus
  mission_type?: string | null
  completed_at?: string | null
  finalized_at?: string | null
}

/**
 * Routes predating this workflow use `return` and `transfer`.  Keep both
 * values valid and present a stable stop meaning without rewriting records.
 */
export function stopKind(type?: string | null): StopKind {
  if (type === 'pickup') return 'pickup'
  if (type === 'return' || type === 'branch') return 'branch'
  return 'delivery'
}

export function orderedStops<T extends WorkflowStop>(stops: T[]) {
  return [...stops].sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
}

export function isRequiredStop(stop: WorkflowStop) {
  return !['cancelled'].includes(stop.status)
}

export function isStopComplete(stop: WorkflowStop) {
  return ['completed', 'cancelled'].includes(stop.status)
}

export function nextRequiredStop<T extends WorkflowStop>(stops: T[]) {
  return orderedStops(stops).find(stop => isRequiredStop(stop) && !isStopComplete(stop))
}

/** A driver may finish the queue only after every required stop is complete. */
export function canFinalizeRoute(stops: WorkflowStop[]) {
  const required = stops.filter(isRequiredStop)
  return required.length > 0 && required.every(isStopComplete) && !required.some(stop => Boolean(stop.finalized_at))
}

export function routeProgress(stops: WorkflowStop[]) {
  const required = orderedStops(stops).filter(isRequiredStop)
  return {
    total: required.length,
    completed: required.filter(isStopComplete).length,
    next: nextRequiredStop(required),
    readyToFinalize: canFinalizeRoute(required),
  }
}

export function stopAction(kind: StopKind, arrived: boolean) {
  // A branch stop is intentionally one-touch. It records arrival and closes
  // that stop in the same action; it never closes the full route queue.
  if (kind === 'branch') return 'complete_branch'
  if (!arrived) return 'arrived'
  if (kind === 'pickup') return 'confirm_pickup'
  return 'complete_delivery'
}
