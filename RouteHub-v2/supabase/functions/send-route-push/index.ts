import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {status, headers: {...cors, 'content-type': 'application/json'}})
const managerRoles = ['branch_manager', 'operations_manager', 'sales_representative', 'counter_sales']

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', {headers: cors})
  if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405)
  try {
    const authorization = request.headers.get('Authorization') || ''
    if (!authorization) return json({error: 'Unauthorized'}, 401)
    const {routeId, event, action} = await request.json() as {routeId?: string; event?: 'assigned' | 'updated'; action?: 'config'}

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const callerClient = createClient(url, anonKey, {global: {headers: {Authorization: authorization}}})
    const {data: userData, error: userError} = await callerClient.auth.getUser()
    if (userError || !userData.user) return json({error: 'Unauthorized'}, 401)

    // The VAPID public key is deliberately shareable with the browser. Keeping
    // it behind an authenticated Edge response avoids duplicating setup in
    // Vercel while never exposing the private signing key.
    if (action === 'config') {
      const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
      if (!publicKey) return json({error: 'VAPID push secrets are not configured'}, 503)
      return json({vapidPublicKey: publicKey})
    }
    if (!routeId || !['assigned', 'updated'].includes(event || '')) return json({error: 'Invalid route notification request'}, 400)

    const service = createClient(url, serviceKey)
    const {data: route, error: routeError} = await service.from('routes')
      .select('id,company_id,branch_id,driver_id,mission_type,destination_name,destination_address,order_number,status')
      .eq('id', routeId).maybeSingle()
    if (routeError) throw routeError
    if (!route) return json({error: 'Route not found'}, 404)

    const {data: callerMembership, error: membershipError} = await service.from('company_users')
      .select('role,branch_id').eq('company_id', route.company_id).eq('user_id', userData.user.id).maybeSingle()
    if (membershipError) throw membershipError
    if (!callerMembership || !managerRoles.includes(callerMembership.role)) return json({error: 'Manager access required'}, 403)
    if (callerMembership.role === 'branch_manager' && callerMembership.branch_id && route.branch_id && callerMembership.branch_id !== route.branch_id) return json({error: 'Route belongs to another branch'}, 403)

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const subject = Deno.env.get('VAPID_SUBJECT')
    if (!publicKey || !privateKey || !subject) return json({error: 'VAPID push secrets are not configured'}, 503)
    webpush.setVapidDetails(subject, publicKey, privateKey)

    const {data: subscriptions, error: subscriptionError} = await service.from('push_subscriptions')
      .select('id,endpoint,p256dh,auth').eq('user_id', route.driver_id)
    if (subscriptionError) throw subscriptionError

    const kind = String(route.mission_type || 'delivery').toLowerCase()
    const isReturn = kind === 'return' || kind === 'branch'
    const isPickup = kind === 'pickup'
    const storeOrClient = String(route.destination_name || '').trim()
    const address = String(route.destination_address || '').trim()
    const po = String(route.order_number || '').trim()
    const assigned = event === 'assigned'
    const title = assigned
      ? isPickup
        ? 'New pickup'
        : isReturn
          ? 'Return to branch'
          : 'New delivery'
      : 'Route updated'
    const body = assigned
      ? isPickup
        ? [storeOrClient || 'Pickup', po || address].filter(Boolean).join('\n')
        : isReturn
          ? address || storeOrClient || 'Branch'
          : [storeOrClient || 'Delivery', address || po].filter(Boolean).join('\n')
      : `${storeOrClient || address || 'Your route'} was updated.`
    const payload = JSON.stringify({
      title,
      body,
      href: '/driver',
      tag: `route:${route.id}`,
    })
    const results = await Promise.allSettled((subscriptions || []).map(subscription => webpush.sendNotification({endpoint: subscription.endpoint, keys: {p256dh: subscription.p256dh, auth: subscription.auth}}, payload)))
    const staleIds = results.flatMap((result, index) => result.status === 'rejected' && (result.reason?.statusCode === 404 || result.reason?.statusCode === 410) ? [subscriptions![index].id] : [])
    if (staleIds.length) await service.from('push_subscriptions').delete().in('id', staleIds)
    return json({ok: true, delivered: results.filter(result => result.status === 'fulfilled').length, subscriptions: subscriptions?.length || 0})
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unable to send route notification'
    console.error(detail)
    return json({error: detail}, 500)
  }
})
