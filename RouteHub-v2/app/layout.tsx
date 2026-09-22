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
  title: {default: 'RouteHub Driver — Routes and navigation', template: '%s · RouteHub Driver'},
  description: 'RouteHub Driver routes, navigation and proof of delivery.',
  // This layout also serves /login.  A PWA gets its name and home-screen icon
  // when it is installed, not after authentication, so the driver identity
  // must be present before a driver signs in.
  applicationName: 'RouteHub Driver',
  manifest: '/manifest.json?v=21',
  appleWebApp: {capable: true, title: 'RouteHub Driver', statusBarStyle: 'default' as const},
  icons: {icon: '/routehub-driver-new.jpg?v=21', apple: '/routehub-driver-new.jpg?v=21'},
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  // The app defaults to the dark driver chrome. Keeping the static value in
  // sync prevents a blue/white browser safe-area strip before hydration.
  themeColor: '#0f1d35',
}

// Apply the stored theme before React paints. ThemeBoot continues to keep it
// in sync after hydration, but this prevents the document's light default from
// peeking through underneath Manager or Driver while dark mode is loading.
const themeBootstrap = `(()=>{try{const saved=localStorage.getItem('routehub_theme');const preference=saved==='light'||saved==='dark'||saved==='system'?saved:'dark';const theme=preference==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):preference;const color=theme==='dark'?'#0f1d35':'#ffffff';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;const applyThemeColor=()=>{const metas=document.querySelectorAll('meta[name="theme-color"]');if(!metas.length&&document.head){const meta=document.createElement('meta');meta.name='theme-color';document.head.appendChild(meta)}document.querySelectorAll('meta[name="theme-color"]').forEach(meta=>meta.setAttribute('content',color))};applyThemeColor();document.addEventListener('DOMContentLoaded',applyThemeColor,{once:true})}catch{}})()`

export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en"><head><script dangerouslySetInnerHTML={{__html: themeBootstrap}}/></head><body><PwaRegister/><ThemeBoot/><AppErrorListener/><AuthBoundary><GlobalChrome/>{children}<AppBottomNav/><TermsGate/><OnboardingGate/></AuthBoundary></body></html>
}
