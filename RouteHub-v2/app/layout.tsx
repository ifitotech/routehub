import './globals.css'
import './final-polish.css'
import './driver-v3/v3-app.css'
import 'leaflet/dist/leaflet.css'
import PwaRegister from './pwa-register'
import ThemeBoot from './theme-boot'
import GlobalChrome from './global-chrome'
import AuthBoundary from './auth-boundary'
import AppBottomNav from './app-bottom-nav'
import OnboardingGate from './onboarding-gate'
import TermsGate from './terms-gate'
import AppErrorListener from './app-error-listener'

export const metadata = {
  title: {default: 'RouteHub', template: '%s · RouteHub'},
  description: 'RouteHub Driver routes, navigation and proof of delivery.',
  // This layout also serves /login.  A PWA gets its name and home-screen icon
  // when it is installed, not after authentication, so the driver identity
  // must be present before a driver signs in.
  applicationName: 'RouteHub Driver',
  manifest: '/manifest.json?v=22',
  // This is the metadata read first by an installed PWA. Keep it aligned
  // with the Driver layout so in-app navigation can draw the map behind the
  // system indicators instead of inheriting an opaque root status strip.
  appleWebApp: {capable: true, title: 'RouteHub Driver', statusBarStyle: 'black-translucent' as const},
  icons: {icon: '/routehub-driver-pwa-512.png', apple: '/routehub-driver-pwa-512.png'},
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  // Give the browser the correct first-paint color before the stored RouteHub
  // preference can override it during the inline theme bootstrap.
  themeColor: [
    {media: '(prefers-color-scheme: light)', color: '#FFFFFF'},
    {media: '(prefers-color-scheme: dark)', color: '#0F1D35'},
  ],
}

// Apply the stored theme before React paints. ThemeBoot continues to keep it
// in sync after hydration, but this prevents the document's light default from
// peeking through underneath Manager or Driver while dark mode is loading.
const themeBootstrap = `(()=>{try{const saved=localStorage.getItem('routehub_theme');const preference=saved==='light'||saved==='dark'||saved==='system'?saved:'dark';const theme=preference==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):preference;const color=theme==='dark'?'#0f1d35':'#ffffff';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;const applyThemeColor=()=>{const metas=document.querySelectorAll('meta[name="theme-color"]');if(!metas.length&&document.head){const meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta)}document.querySelectorAll('meta[name="theme-color"]').forEach(meta=>meta.setAttribute('content',color))};applyThemeColor();document.addEventListener('DOMContentLoaded',applyThemeColor,{once:true})}catch{}})()`

export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: themeBootstrap}}/></head><body><PwaRegister/><ThemeBoot/><AppErrorListener/><AuthBoundary><GlobalChrome/>{children}<AppBottomNav/><TermsGate/><OnboardingGate/></AuthBoundary></body></html>
}
