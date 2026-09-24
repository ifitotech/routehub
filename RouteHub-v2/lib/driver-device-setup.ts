'use client'

import {Capacitor} from '@capacitor/core'
import {getCurrentLocation, getLocationPermission} from './location'
import {registerPushNotifications} from './push-notifications'

export type DriverDeviceSetupResult = {
  location: 'granted' | 'denied' | 'unavailable' | 'error'
  notifications: 'granted' | 'denied' | 'unavailable' | 'error'
}

/**
 * Called only from the driver's explicit setup button. Browsers require a
 * user gesture for notification permission, and geolocation must be requested
 * in context. Reading/requesting consent here never uploads the returned fix.
 */
export async function prepareDriverDevice(): Promise<DriverDeviceSetupResult> {
  const result: DriverDeviceSetupResult = {location: 'error', notifications: 'error'}

  try {
    if (Capacitor.isNativePlatform()) {
      await registerPushNotifications()
      result.notifications = 'granted'
    } else if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      result.notifications = 'unavailable'
    } else {
      let permission = Notification.permission
      if (permission === 'default') permission = await Notification.requestPermission()
      if (permission === 'granted') {
        // Permission was obtained directly in the click handler above; finish
        // push registration so the switch in Settings reflects a real token.
        await registerPushNotifications()
        result.notifications = 'granted'
      } else {
        result.notifications = 'denied'
      }
    }
  } catch {
    result.notifications = 'error'
  }

  try {
    const permission = await getLocationPermission()
    if (permission === 'unsupported') {
      result.location = 'unavailable'
    } else if (permission === 'denied') {
      result.location = 'denied'
    } else {
      // This is deliberately not persisted or sent to RouteHub. It only lets
      // the OS show its location prompt before the driver starts the route.
      await getCurrentLocation({maximumAge: 0})
      result.location = 'granted'
    }
  } catch (error) {
    result.location = error instanceof Error && /permission.*denied/i.test(error.message) ? 'denied' : 'error'
  }

  return result
}
