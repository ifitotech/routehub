import type {Metadata, Viewport} from 'next'
import DriverSessionGate from '../driver/driver-session-gate'
import DriverV3AppMode from './app-mode'
import DriverLiveLocation from './driver-live-location'
import {DriverV3Provider} from '../../lib/driver-v3/use-driver-data'
import './v3-app.css'

export const metadata: Metadata = {
  title: 'RouteHub Driver',
  applicationName: 'RouteHub Driver',
  manifest: '/manifest-driver.json',
  appleWebApp: {
    capable: true,
    title: 'RouteHub Driver',
    statusBarStyle: 'black',
  },
  icons: {
    icon: '/routehub-driver-new.jpg?v=19',
    apple: '/routehub-driver-new.jpg?v=19',
  },
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-opaque',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    {media: '(prefers-color-scheme: light)', color: '#0F1D35'},
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
