import type {Metadata, Viewport} from 'next'
import DriverSessionGate from '../../components/driver-v3/driver-session-gate'
import DriverV3AppMode from './app-mode'
import DriverLiveLocation from './driver-live-location'
import {DriverV3Provider} from '../../lib/driver-v3/use-driver-data'
import './v3-app.css'
import './dark-theme.css'
import './driver-theme-tokens.css'
import './driver-modern.css'

export const metadata: Metadata = {
  title: {absolute: 'RouteHub Driver'},
  applicationName: 'RouteHub Driver',
  // Version the manifest URL so installed PWAs re-read orientation/theme
  // metadata instead of retaining the browser's previous manifest snapshot.
  manifest: '/manifest-driver.json?v=22',
  // Navigation is a continuous map surface. A translucent status area lets
  // the driving canvas extend behind the system indicators; route cards keep
  // their own contrast rather than reserving a separate navy strip.
  appleWebApp: {
    capable: true,
    title: 'RouteHub Driver',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/routehub-driver-pwa-512.png',
    apple: '/routehub-driver-pwa-512.png',
  },
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Required for the map to reach the status area during in-app navigation.
  viewportFit: 'cover',
  themeColor: [
    {media: '(prefers-color-scheme: light)', color: '#FFFFFF'},
    {media: '(prefers-color-scheme: dark)', color: '#0F1D35'},
  ],
}

/** Isolated V3 entry. Session gate remains authoritative. No Manager chrome. */
export default function DriverV3Layout({children}: {children: React.ReactNode}) {
  return (
    <DriverSessionGate>
      <DriverV3Provider>
      <div className="driver-v3-root"><DriverV3AppMode /><DriverLiveLocation />{children}</div>
      </DriverV3Provider>
    </DriverSessionGate>
  )
}
