'use client'

import {Capacitor, registerPlugin} from '@capacitor/core'

export type DeviceAccessStatus = {location: string; camera: string; versionCode: number}

/**
 * Capacitor keeps a global plugin registry. Register DeviceAccess once so the
 * permissions, updater, and location modules always call the same native
 * bridge instance.
 */
export const deviceAccess = registerPlugin<{
  status(): Promise<DeviceAccessStatus>
  request(options: {permission: 'location' | 'camera'}): Promise<DeviceAccessStatus>
  openSettings(): Promise<void>
  downloadUpdate(options: {url: string; fileName: string}): Promise<{downloadId?: string; requiresInstallPermission?: boolean}>
  startLocationTracking(options: {supabaseUrl: string; supabaseAnonKey: string; accessToken: string; refreshToken: string; sessionId: string; driverId: string; intervalMinutes: number}): Promise<void>
  stopLocationTracking(): Promise<void>
}>('DeviceAccess')

export {Capacitor}
