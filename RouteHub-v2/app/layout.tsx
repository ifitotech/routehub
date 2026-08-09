import './globals.css'
import './final-polish.css'
import PwaRegister from './pwa-register'
import ThemeBoot from './theme-boot'
import GlobalChrome from './global-chrome'
import AuthBoundary from './auth-boundary'

export const metadata = {
  title: {default: 'RouteHub', template: '%s · RouteHub'},
  description: 'Smarter routes. Better deliveries.',
  applicationName: 'RouteHub',
  manifest: '/manifest.json',
  appleWebApp: {capable: true, title: 'RouteHub', statusBarStyle: 'default' as const},
  icons: {icon: '/routehub-icon-512.png', apple: '/routehub-icon-192.png'},
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#2563eb',
}

export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en"><body><PwaRegister/><ThemeBoot/><AuthBoundary><GlobalChrome/>{children}</AuthBoundary></body></html>
}
