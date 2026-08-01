import './globals.css'
import PwaRegister from './pwa-register'
import QuickNav from './quick-nav'
import ThemeToggle from './theme-toggle'
export const metadata = { title: 'RouteHub', description: 'Rutas simples para equipos de entrega', manifest: '/manifest.json', icons:{icon:'/routehub-logo.png',apple:'/routehub-logo.png'} }
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body><PwaRegister /><ThemeToggle /><QuickNav />{children}</body></html> }
