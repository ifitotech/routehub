import {getSupabase} from './supabase'

export type RoutePushEvent = 'assigned' | 'updated'

// Deliberately non-blocking: dispatch is an enhancement and must never undo a
// successfully saved route if an individual device has an expired endpoint.
export async function sendRoutePush(routeId: string, event: RoutePushEvent) {
  try {
    const {error} = await getSupabase().functions.invoke('send-route-push', {body: {routeId, event}})
    if (error) console.warn('Route push dispatch failed', error.message)
  } catch (error) {
    console.warn('Route push dispatch failed', error)
  }
}
