'use client'

import {Capacitor, deviceAccess} from './device-access'

export async function downloadAndroidUpdate(version: string) {
  const url = new URL('/routehub-driver.apk', window.location.origin).toString()
  const fileName = `RouteHub-Driver-${version}.apk`
  if (Capacitor.getPlatform() === 'android') {
    const result = await deviceAccess.downloadUpdate({url, fileName})
    return result.requiresInstallPermission ? 'permission' : 'native'
  }
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  return 'browser'
}
