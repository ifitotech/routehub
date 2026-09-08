import type {CapacitorConfig} from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.routehub.driver',
  appName: 'RouteHub Driver',
  webDir: 'www',
  bundledWebRuntime: false,
  server: process.env.CAPACITOR_SERVER_URL
    ? {url: process.env.CAPACITOR_SERVER_URL, cleartext: false}
    : undefined,
  android: {
    backgroundColor: '#0f1d35',
  },
}

export default config
