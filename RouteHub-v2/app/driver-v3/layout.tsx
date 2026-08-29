import type {Metadata} from 'next'
import DriverSessionGate from '../driver/driver-session-gate'

export const metadata: Metadata = {
  title: 'RouteHub Driver V3',
  manifest: '/manifest-driver.json',
  appleWebApp: {capable: true, title: 'RouteHub Driver V3', statusBarStyle: 'default'},
  icons: {icon: '/routehub-driver-new.jpg', apple: '/routehub-driver-new.jpg'},
}

/** Isolated V3 entry point. The existing session gate remains authoritative. */
export default function DriverV3Layout({children}: {children: React.ReactNode}) {
  return <DriverSessionGate>{children}</DriverSessionGate>
}
