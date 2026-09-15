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
  title: 'RouteHub Driver',
  applicationName: 'RouteHub Driver',
  // Version the manifest URL so installed PWAs re-read orientation/theme
  // metadata instead of retaining the browser's previous manifest snapshot.
  manifest: '/manifest-driver.json?v=2',
  // black-translucent, not black: 'black' paints iOS's own solid black bar,
  // which reads as pure black next to this app's navy (#0F1D35) header - a
  // visible two-tone seam/haze right where they meet. black-translucent
  // makes the status bar transparent instead, so the header's own
  // safe-area-inset-top padding (see .appHeader in driver-v3-b.module.css)
  // paints the real navy all the way up, with nothing else layered on top.
  appleWebApp: {
    capable: true,
    title: 'RouteHub Driver',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/routehub-driver-new.jpg?v=20',
    apple: '/routehub-driver-new.jpg?v=20',
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
