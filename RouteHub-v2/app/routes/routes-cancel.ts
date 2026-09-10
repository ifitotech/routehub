import {getSupabase} from '../../lib/supabase'
import {sendRoutePush} from '../../lib/route-push'
import type {RouteRecord} from './routes-model'

export async function cancelPublishedRoute(route: RouteRecord, locale: string) {
  const label = route.destination_name || route.destination_address || 'route'
  const ok = window.confirm(locale==='es' ? `Cancelar ${label}?` : locale==='fr' ? `Annuler ${label} ?` : `Cancel ${label}?`)
  if (!ok) return false
  const client = getSupabase()
  const {error} = await client.from('routes').update({status: 'cancelled', updated_version: Date.now()}).eq('id', route.id)
  if (error) throw error
  if (route.driver_id && route.company_id) {
    let queueQuery = client.from('routes').select('id,position').eq('company_id', route.company_id).eq('route_date', route.route_date || '').eq('driver_id', route.driver_id).in('status', ['draft', 'pending', 'published', 'paused']).order('position').order('id')
    queueQuery = route.branch_id == null ? queueQuery.is('branch_id', null) : queueQuery.eq('branch_id', route.branch_id)
    const {data: remaining, error: queueError} = await queueQuery
    if (queueError) throw queueError
    const ids = (remaining || []).map((item: {id: string}) => item.id)
    if (ids.length) {
      const {error: reorderError} = await client.rpc('reorder_route_queue', {p_route_ids: ids})
      if (reorderError) throw reorderError
    }
  }
  void sendRoutePush(route.id, 'updated')
  return true
}
