import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {JWT} from 'npm:google-auth-library@9.15.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {status, headers: {...cors, 'content-type': 'application/json'}})
const managerRoles = ['branch_manager', 'operations_manager', 'sales_representative', 'counter_sales']

async function sendNativePush(tokens: string[], title: string, body: string, routeId: string) {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
  const email = Deno.env.get('FIREBASE_CLIENT_EMAIL')
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n')
  if (!tokens.length) return 0
  if (!projectId || !email || !privateKey) throw new Error('Firebase Cloud Messaging secrets are not configured')
  const auth = new JWT({email, key: privateKey, scopes: ['https://www.googleapis.com/auth/firebase.messaging']})
  const {token} = await auth.getAccessToken()
  if (!token) return 0
  const results = await Promise.allSettled(tokens.map(deviceToken => fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${token}`}, body: JSON.stringify({message: {token: deviceToken, notification: {title, body}, data: {href: '/driver', routeId}}})})))
  return results.filter(result => result.status === 'fulfilled' && result.value.ok).length
}

async function sendPushToDriver(service: ReturnType<typeof createClient>, driverId: string, title: string, body: string, routeId = '') {
  const {data: subscriptions, error: subscriptionError} = await service.from('push_subscriptions')
    .select('id,endpoint,p256dh,auth').eq('user_id', driverId)
  if (subscriptionError) throw subscriptionError
  const {data: nativeTokens, error: nativeTokenError} = await service.from('native_push_tokens')
    .select('token').eq('user_id', driverId).eq('platform', 'android')
  if (nativeTokenError) throw nativeTokenError

  const payload = JSON.stringify({title, body, href: '/driver', tag: routeId ? `route:${routeId}` : 'routehub:morning-reminder'})
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  const webPushConfigured = Boolean(publicKey && privateKey && subject)
  if ((subscriptions || []).length && webPushConfigured) webpush.setVapidDetails(subject!, publicKey!, privateKey!)
  if ((subscriptions || []).length && !webPushConfigured) console.warn('Web push skipped because VAPID secrets are not configured')
  const results = webPushConfigured
    ? await Promise.allSettled((subscriptions || []).map(subscription => webpush.sendNotification({endpoint: subscription.endpoint, keys: {p256dh: subscription.p256dh, auth: subscription.auth}}, payload)))
    : []
  const nativeDelivered = await sendNativePush((nativeTokens || []).map(item => item.token), title, body, routeId)
  const staleIds = results.flatMap((result, index) => result.status === 'rejected' && (result.reason?.statusCode === 404 || result.reason?.statusCode === 410) ? [subscriptions![index].id] : [])
  if (staleIds.length) await service.from('push_subscriptions').delete().in('id', staleIds)
  return {delivered: results.filter(result => result.status === 'fulfilled').length + nativeDelivered, subscriptions: subscriptions?.length || 0, nativeTokens: nativeTokens?.length || 0, webPushConfigured}
}

function newYorkNow() {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'}).formatToParts(new Date())
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  return {date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour || '0')}
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', {headers: cors})
  if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405)
  try {
    const authorization = request.headers.get('Authorization') || ''
    const {routeId, event, action} = await request.json() as {routeId?: string; event?: 'assigned' | 'updated'; action?: 'config' | 'morning_reminder'}

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const service = createClient(url, serviceKey)
    if (action === 'morning_reminder') {
      const expectedSecret = Deno.env.get('ROUTE_REMINDER_CRON_SECRET') || ''
      if (!expectedSecret || request.headers.get('x-routehub-cron-secret') !== expectedSecret) return json({error: 'Unauthorized'}, 401)
      const now = newYorkNow()
      // The job runs once at each possible UTC offset. Only the run that is
      // actually 07:00 in Miami sends the reminder, so daylight saving time
      // never shifts the driver's workday notification.
      if (now.hour !== 7) return json({ok: true, skipped: 'outside_morning_window'})
      const {data: routes, error: routeError} = await service.from('routes')
        .select('id,company_id,driver_id,destination_name,destination_address')
        .eq('route_date', now.date).not('driver_id', 'is', null)
        .in('status', ['draft', 'pending', 'published', 'paused'])
      if (routeError) throw routeError
      const grouped = new Map<string, {companyId: string; driverId: string; routes: Array<{id: string; destination_name?: string|null; destination_address?: string|null}>}>()
      for (const route of routes || []) {
        if (!route.company_id || !route.driver_id) continue
        const key = `${route.company_id}:${route.driver_id}`
        const entry = grouped.get(key) || {companyId: route.company_id, driverId: route.driver_id, routes: []}
        entry.routes.push(route)
        grouped.set(key, entry)
      }
      let delivered = 0
      let skipped = 0
      for (const entry of grouped.values()) {
        const {data: delivery, error: deliveryError} = await service.from('route_reminder_deliveries')
          .insert({company_id: entry.companyId, driver_id: entry.driverId, route_date: now.date, route_count: entry.routes.length})
          .select('id').maybeSingle()
        if (deliveryError?.code === '23505') { skipped++; continue }
        if (deliveryError) throw deliveryError
        const firstStop = entry.routes[0]?.destination_name || entry.routes[0]?.destination_address || 'RouteHub'
        const title = entry.routes.length === 1 ? 'Your route is ready' : 'Your routes are ready'
        const body = entry.routes.length === 1 ? `Today: ${firstStop}. Open RouteHub to start when ready.` : `You have ${entry.routes.length} routes scheduled today. Open RouteHub to review your first stop.`
        const outcome = await sendPushToDriver(service, entry.driverId, title, body)
        delivered += outcome.delivered
        // Do not mark an unavailable device as reminded: the alternate UTC
        // run can retry while it is still 07:00 local time.
        if (!outcome.delivered && delivery?.id) await service.from('route_reminder_deliveries').delete().eq('id', delivery.id)
      }
      return json({ok: true, date: now.date, delivered, skipped})
    }

    if (!authorization) return json({error: 'Unauthorized'}, 401)
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
    return json({ok: true, ...(await sendPushToDriver(service, route.driver_id, title, body, route.id))})
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unable to send route notification'
    console.error(detail)
    return json({error: detail}, 500)
  }
})
