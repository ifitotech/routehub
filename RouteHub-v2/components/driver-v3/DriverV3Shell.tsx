'use client'

import Link from 'next/link'
import {usePathname, useSearchParams} from 'next/navigation'
import {ChevronLeft, History, Home, Map as MapIcon, RotateCw, Settings, Truck, UserRound} from 'lucide-react'
import shellA from './driver-v3-a.module.css'
import shellB from './driver-v3-b.module.css'
import './driver-route-swipe.css'
import {useLocale} from '../../lib/use-preferences'

const styles = {...shellA, ...shellB}

type Tab = 'today' | 'map' | 'history' | 'truck' | 'more'

type Props = {
  children: React.ReactNode
  active: Tab
  mode?: 'tab' | 'stack'
  title?: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  headerStatus?: string
  flush?: boolean
  hideNav?: boolean
  hideHeader?: boolean
  swipeDownTo?: string
  // Today (and any screen that needs it) can swap the default profile
  // shortcut for its own header action - the Tools menu (Maps/Call/
  // Report an issue), for example - without every other Driver screen
  // (History, Truck, Settings) losing its usual way into Profile.
  rightSlot?: React.ReactNode
}

export default function DriverV3Shell({
  children,
  active,
  mode = 'tab',
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  headerStatus,
  flush = false,
  hideNav = false,
  hideHeader = false,
  swipeDownTo,
  rightSlot,
}: Props) {
  const {t} = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isStack = mode === 'stack'
  const profileOpen = pathname === '/driver/more' || pathname.startsWith('/driver/more/')
  const menuHref = profileOpen ? '/driver' : '/driver/more'
  const mapOpen = pathname === '/driver/map' || (pathname === '/driver' && searchParams.get('view') === 'map')

  return (
    <main data-driver-screen={active} className={`${styles.shell} ${active === 'today' ? styles.todaySurface : ''}`}>
      <header
        style={{
          zIndex: 300,
          boxSizing: 'border-box',
          // iOS 26/27's "Liquid Glass" scroll-edge effect (a system-drawn
          // blur WebKit applies over the safe-area-inset-top strip, not
          // something a web page can turn off - see WebKit bug 295843,
          // whose fix is a native WKWebView API with no web equivalent)
          // documented reports put its bleed at roughly 30px past the
          // inset. This extra buffer keeps the actual logo/text that far
          // clear of the edge, so the effect has nothing but flat header
          // background to blur instead of the brand mark - it can't be
          // eliminated from here, only kept off the content that matters.
          height: 'calc(48px + env(safe-area-inset-top) + 28px)',
          minHeight: 'calc(48px + env(safe-area-inset-top) + 28px)',
          padding: 'calc(env(safe-area-inset-top) + 28px) 16px 0',
        }}
        className={`${styles.header} ${styles.appHeader} ${hideHeader ? styles.headerHidden : ''}`}
      >
        {isStack ? (
          <Link href={backHref || '/driver'} className={styles.headerIcon} aria-label={backLabel}>
            <ChevronLeft size={22} strokeWidth={2.4} />
          </Link>
        ) : (
          <Link href={mapOpen ? '/driver' : '/driver?view=map'} className={styles.headerIcon} aria-label={mapOpen ? (t.drvToday || 'Today') : (t.drvMap || 'Map')}>
            {mapOpen ? <Home size={22} strokeWidth={2.2} /> : <MapIcon size={22} strokeWidth={2.2} />}
          </Link>
        )}
        <Link href="/driver" className={styles.headerBrand}>
          <img src="/routehub-driver-new.jpg" alt="" width={32} height={32} />
          <span>RouteHub</span>
        </Link>
        {rightSlot || (
          <Link href={menuHref} className={styles.headerIcon} aria-label={t.drvProfile}>
            <UserRound strokeWidth={2.2} />
          </Link>
        )}
      </header>

      <section data-driver-screen={active} className={`${styles.content} ${flush ? styles.contentFlush : ''} ${active === 'today' ? styles.contentToday : ''}`}>{children}</section>

      <nav className={`${styles.nav} ${hideNav ? styles.navHidden : ''}`} aria-label="Driver navigation">
        <Link className={active === 'today' ? styles.active : ''} href="/driver">
          <Home />
          <span>{t.drvToday}</span>
        </Link>
        <Link className={active === 'history' ? styles.active : ''} href="/driver/history">
          <History />
          <span>{t.routes || 'Routes'}</span>
        </Link>
        <Link className={active === 'truck' ? styles.active : ''} href="/driver/truck">
          <Truck />
          <span>{t.drvTruck}</span>
        </Link>
        <Link className={active === 'more' ? styles.active : ''} href="/driver/settings">
          <Settings />
          <span>{t.drvMore || 'More'}</span>
        </Link>
      </nav>
      <aside className={styles.rotatePortrait} role="status" aria-live="polite">
        <RotateCw aria-hidden="true" />
        <strong>Rotate your device</strong>
        <span>RouteHub Driver is designed for portrait mode.</span>
      </aside>
    </main>
  )
}
