import { getSupabase } from './supabase'

export async function registerPushNotifications(vapidPublicKey: string) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push notifications are not supported in this browser.')
  if (!vapidPublicKey) throw new Error('Push notifications are not configured yet.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  const registration = await navigator.serviceWorker.register('/routehub-push-sw.js', { scope: '/' })
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKey })
  const json = subscription.toJSON()
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user || !json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Sign in before enabling notifications.')
  const { error } = await getSupabase().from('push_subscriptions').upsert({ user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent, updated_at: new Date().toISOString() }, { onConflict: 'user_id,endpoint' })
  if (error) throw error
  return subscription
}
