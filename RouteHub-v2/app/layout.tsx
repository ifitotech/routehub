import './globals.css'
import './final-polish.css'
import PwaRegister from './pwa-register'
import ThemeBoot from './theme-boot'
import GlobalChrome from './global-chrome'
import AuthBoundary from './auth-boundary'
import AppBottomNav from './app-bottom-nav'

export const metadata = {
  title: {default: 'RouteHub — Simple Route Management for Your Team', template: '%s · RouteHub'},
  description: 'Create routes, assign drivers, track progress and keep every stop updated with RouteHub.',
  applicationName: 'RouteHub',
  manifest: '/manifest.json',
  appleWebApp: {capable: true, title: 'RouteHub', statusBarStyle: 'default' as const},
  icons: {icon: '/routehub-regular-new.jpg', apple: '/routehub-regular-new.jpg'},
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#2563eb',
}

export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en"><body><PwaRegister/><ThemeBoot/><AuthBoundary><GlobalChrome/>{children}<AppBottomNav/></AuthBoundary></body></html>
}
