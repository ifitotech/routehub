import type {CapacitorConfig} from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.routehub.driver',
  appName: 'RouteHub Driver',
  webDir: 'www',
  // Production APKs must always load the deployed Driver web app. A local
  // server URL makes a sideloaded phone fail with ERR_CONNECTION_REFUSED.
  server: {
    url: 'https://routehub-wisu.vercel.app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#0f1d35',
  },
}

export default config
