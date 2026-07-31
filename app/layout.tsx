import './globals.css'
import PwaRegister from './pwa-register'
import QuickNav from './quick-nav'
export const metadata = { title: 'RouteHub', description: 'Rutas simples para equipos de entrega', manifest: '/manifest.json' }
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body><PwaRegister /><QuickNav />{children}</body></html> }
