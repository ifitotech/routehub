import './globals.css'
export const metadata = { title: 'RouteHub', description: 'Rutas simples para equipos de entrega', manifest: '/manifest.json' }
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body>{children}</body></html> }
