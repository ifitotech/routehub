import {getSupabase} from './supabase'

export type RoutePushEvent = 'assigned' | 'updated' | 'unassigned'

// Deliberately non-blocking: dispatch is an enhancement and must never undo a
// successfully saved route if an individual device has an expired endpoint.
//
// driverId is only needed when the route's driver_id in the database no
// longer matches who should be notified - e.g. unassigning a route sets
// driver_id to null before this call, so the edge function's own lookup of
// route.driver_id would find nobody. Pass the driver being notified (the one
// losing the route) explicitly in that case; omit it for every other event,
// where the edge function's own lookup of the route's current driver is
// correct.
export async function sendRoutePush(routeId: string, event: RoutePushEvent, driverId?: string) {
  try {
    const {error} = await getSupabase().functions.invoke('send-route-push', {body: {routeId, event, driverId}})
    if (error) console.warn('Route push dispatch failed', error.message)
  } catch (error) {
    console.warn('Route push dispatch failed', error)
  }
}
