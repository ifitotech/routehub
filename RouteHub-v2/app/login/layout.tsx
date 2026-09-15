import type {Metadata, Viewport} from 'next'

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: 'RouteHub',
    statusBarStyle: 'default',
  },
}

// Login is an intentionally light surface. Emitting white directly in the
// server-rendered head prevents the installed PWA from first painting the
// Driver navy status area and then dissolving into the white login header.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export default function LoginLayout({children}: {children: React.ReactNode}) {
  return children
}
