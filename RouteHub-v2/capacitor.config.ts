import type {CapacitorConfig} from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.routehub.driver',
  appName: 'RouteHub Driver',
  webDir: 'www',
  // The sideloaded Android build must always point at the deployed web app.
  // An environment override is still supported for local/staging builds.
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://routehub-wisu.vercel.app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#0f1d35',
  },
}

export default config
