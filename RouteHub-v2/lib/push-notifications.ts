import { getSupabase } from './supabase'
import {Capacitor, registerPlugin} from '@capacitor/core'

type NativePush = {
  requestPermissions(): Promise<{receive: string}>
  register(): Promise<void>
  addListener(event: 'registration', cb: (token: {value: string}) => void): Promise<{remove(): Promise<void>}>
  addListener(event: 'registrationError', cb: (error: {error?: string}) => void): Promise<{remove(): Promise<void>}>
}
const nativePush = registerPlugin<NativePush>('PushNotifications')

async function getVapidPublicKey() {
  const configured = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  if (configured) return configured
  const {data, error} = await getSupabase().functions.invoke('send-route-push', {body: {action: 'config'}})
  if (error) throw new Error('Push notifications are not configured yet.')
  const key = typeof data?.vapidPublicKey === 'string' ? data.vapidPublicKey : ''
  if (!key) throw new Error('Push notifications are not configured yet.')
  return key
}

export async function registerPushNotifications(vapidPublicKey?: string) {
  if (Capacitor.isNativePlatform()) {
    const permission = await nativePush.requestPermissions()
    if (permission.receive !== 'granted') throw new Error('Notification permission was not granted.')
    const {data: {user}} = await getSupabase().auth.getUser()
    if (!user) throw new Error('Sign in before enabling notifications.')
    const token = await new Promise<string>((resolve, reject) => {
      let registrationHandle: {remove(): Promise<void>} | undefined
      let errorHandle: {remove(): Promise<void>} | undefined
      const cleanup = () => { void registrationHandle?.remove(); void errorHandle?.remove() }
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Unable to register this device for notifications.')) }, 15000)
      void Promise.all([
        nativePush.addListener('registration', value => { window.clearTimeout(timeout); cleanup(); resolve(value.value) }),
        nativePush.addListener('registrationError', value => {
          window.clearTimeout(timeout)
          cleanup()
          reject(new Error(value.error || 'Firebase could not register this device for notifications.'))
        }),
      ]).then(([registration, registrationError]) => {
        registrationHandle = registration
        errorHandle = registrationError
        return nativePush.register()
      }).catch(error => {
        window.clearTimeout(timeout)
        cleanup()
        reject(error)
      })
    })
    const {error} = await getSupabase().from('native_push_tokens').upsert({user_id: user.id, platform: Capacitor.getPlatform(), token, user_agent: navigator.userAgent, updated_at: new Date().toISOString()}, {onConflict: 'user_id,platform,token'})
    if (error) throw error
    return token
  }
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push notifications are not supported in this browser.')
  const key = vapidPublicKey || await getVapidPublicKey()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  // PwaRegister owns /sw.js. Reuse it instead of installing a competing root
  // worker, which made notifications work only while the tab was open.
  await navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'})
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const json = subscription.toJSON()
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user || !json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Sign in before enabling notifications.')
  const { error } = await getSupabase().from('push_subscriptions').upsert({ user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent, updated_at: new Date().toISOString() }, { onConflict: 'user_id,endpoint' })
  if (error) throw error
  return subscription
}
