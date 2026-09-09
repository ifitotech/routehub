'use client'

import {Capacitor, registerPlugin} from '@capacitor/core'

const device = registerPlugin<{downloadUpdate(options: {url: string; fileName: string}): Promise<{downloadId?: string; requiresInstallPermission?: boolean}>}>('DeviceAccess')

export async function downloadAndroidUpdate(version: string) {
  const url = new URL('/routehub-driver.apk', window.location.origin).toString()
  const fileName = `RouteHub-Driver-${version}.apk`
  if (Capacitor.getPlatform() === 'android') {
    const result = await device.downloadUpdate({url, fileName})
    return result.requiresInstallPermission ? 'permission' : 'native'
  }
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  return 'browser'
}
