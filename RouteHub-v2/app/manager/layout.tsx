import type {Metadata, Viewport} from 'next'
import ManagerSessionGate from './manager-session-gate'

export const metadata: Metadata = {
  title: {absolute: 'RouteHub Manager'},
  applicationName: 'RouteHub Manager',
  manifest: '/manifest-manager.json?v=1',
  appleWebApp: {capable: true, title: 'RouteHub Manager', statusBarStyle: 'default'},
  icons: {icon: '/routehub-manager-pwa-512.png', apple: '/routehub-manager-pwa-512.png'},
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [{media: '(prefers-color-scheme: light)', color: '#FFFFFF'}, {media: '(prefers-color-scheme: dark)', color: '#0F1D35'}],
}

export default function ManagerLayout({children}:{children:React.ReactNode}) {
  return <ManagerSessionGate>{children}</ManagerSessionGate>
}
