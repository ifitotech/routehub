import type {Metadata, Viewport} from 'next'
import DriverSessionGate from '../driver/driver-session-gate'
import DriverV3AppMode from './app-mode'
import './v3-app.css'

export const metadata: Metadata = {
  title: 'RouteHub Driver',
  applicationName: 'RouteHub Driver',
  manifest: '/manifest-driver-v3.json',
  appleWebApp: {
    capable: true,
    title: 'RouteHub Driver',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/routehub-driver-new.jpg',
    apple: '/routehub-driver-new.jpg',
  },
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
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
      <div className="driver-v3-root"><DriverV3AppMode />{children}</div>
    </DriverSessionGate>
  )
}
