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
  manifest: '/manifest-driver.json?v=21',
  // Keep the system/status area opaque - translucent (black-translucent)
  // lets iOS draw content under the status bar, and iOS 26/27's "Liquid
  // Glass" material then applies its own system backdrop-blur over that
  // strip regardless of what's painted behind it (a real, current iOS
  // platform behavior, not something fixable from this side). 'default'
  // avoided the blur but is a fixed white bar with black icons on iOS,
  // mismatched with Driver's dark-by-default theme. 'black' is still a
  // fixed, non-theme-reactive color (iOS reads this once, at PWA launch -
  // it doesn't follow an in-session light/dark toggle), but a solid dark
  // bar reads far closer to Driver's own navy than a solid white one does.
  appleWebApp: {
    capable: true,
    title: 'RouteHub Driver',
    statusBarStyle: 'black',
  },
  icons: {
    icon: '/routehub-driver-new.jpg?v=21',
    apple: '/routehub-driver-new.jpg?v=21',
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
