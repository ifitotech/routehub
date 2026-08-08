import './globals.css'
import PwaRegister from './pwa-register'
export const metadata={title:'RouteHub',description:'Smarter routes. Better deliveries.',icons:{icon:'/routehub-logo-transparent.png',apple:'/routehub-logo-transparent.png'}}
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#2468df'}
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><PwaRegister/>{children}</body></html>}
