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
  // platform behavior, not something fixable from this side).
  //
  // 'black' was tried first (reasoning: same opaque/non-translucent
  // behavior as 'default', just dark instead of light) but a driver
  // confirmed the blur on a fully-reinstalled PWA even with 'black' live
  // in production, verified by fetching this app's own deployed HTML.
  // 'default' is the one combination with an actual confirmed real-world
  // fix for this specific iOS 26/27 bug (a fixed white bar, mismatched
  // with Driver's dark-by-default theme, but no blur) - reverted to it to
  // prioritize killing the blur regression over the color match. If this
  // is confirmed fixed, revisit getting closer to Driver's navy without
  // reintroducing the blur (e.g. a native status-bar-color capability
  // instead of this web meta tag, which only ever offers white/black/
  // translucent).
  appleWebApp: {
    capable: true,
    title: 'RouteHub Driver',
    statusBarStyle: 'default',
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
  // Keep the status-area outside the web canvas. On iOS PWAs `cover` lets
  // Safari composite its translucent scroll-edge material over the header;
  // `contain` gives the system an opaque, theme-colored strip instead.
  viewportFit: 'contain',
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
