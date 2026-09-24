'use client'

import {getSupabase} from './supabase'
import {Capacitor, deviceAccess} from './device-access'

function androidNative() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/** Called only while an active route is open in in-app navigation. */
export async function startNativeLocationTracking(input: {sessionId: string; driverId: string; intervalMinutes: 5 | 20}) {
  if (!androidNative()) return false
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl?.startsWith('https://') || !supabaseAnonKey) throw new Error('Secure location sync is not configured.')
  const {data, error} = await getSupabase().auth.getSession()
  if (error || !data.session) throw new Error('Sign in again to share location.')
  await deviceAccess.startLocationTracking({
    supabaseUrl, supabaseAnonKey,
    accessToken: data.session.access_token, refreshToken: data.session.refresh_token,
    sessionId: input.sessionId, driverId: input.driverId, intervalMinutes: input.intervalMinutes,
  })
  return true
}

export async function stopNativeLocationTracking() {
  if (!androidNative()) return false
  await deviceAccess.stopLocationTracking()
  return true
}
