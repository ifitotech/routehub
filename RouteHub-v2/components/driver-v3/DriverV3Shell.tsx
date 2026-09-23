'use client'

import Link from 'next/link'
import {usePathname, useSearchParams} from 'next/navigation'
import {useEffect, useRef, useState} from 'react'
import {ChevronLeft, History, Home, Map as MapIcon, RotateCw, Settings, Truck} from 'lucide-react'
import shellA from './driver-v3-a.module.css'
import shellB from './driver-v3-b.module.css'
import './driver-route-swipe.css'
import {useLocale} from '../../lib/use-preferences'
import NotificationBell from '../../app/notification-bell'

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
  backLabel,
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
  const mapOpen = pathname === '/driver/map' || (pathname === '/driver' && searchParams.get('view') === 'map')
  const autoHideHeader = active !== 'today' && active !== 'map' && !hideHeader
  const [headerVisible, setHeaderVisible] = useState(true)
  const lastScroll = useRef(0)

  useEffect(() => {
    if (!autoHideHeader) { setHeaderVisible(true); return }
    lastScroll.current = window.scrollY
    const onScroll = () => {
      const current = window.scrollY
      const delta = current - lastScroll.current
      if (Math.abs(delta) < 4) return
      if (current < 12 || delta < 0) setHeaderVisible(true)
      else if (delta > 0) setHeaderVisible(false)
      lastScroll.current = current
    }
    window.addEventListener('scroll', onScroll, {passive: true})
    return () => window.removeEventListener('scroll', onScroll)
  }, [autoHideHeader])

  return (
    <main data-driver-screen={active} className={`${styles.shell} ${active === 'today' ? styles.todaySurface : ''} ${hideHeader ? styles.navigationFullscreen : ''}`}>
      {/* Reserves exactly the pre-buffer header height in the grid, so the
          blur-guard overlay below doesn't shrink .content/.nav - only the
          header itself (positioned absolute, floating on top) grows past
          this into the content's own space. */}
      {!hideHeader && <div aria-hidden="true" style={{height: 'calc(48px + env(safe-area-inset-top))'}} />}
      <header
        style={{
          position: 'absolute',
          display: hideHeader ? 'none' : undefined,
          top: 0,
          left: 0,
          right: 0,
          zIndex: 300,
          boxSizing: 'border-box',
          // Keep only the real safe-area inset. The previous extra buffer
          // made the header look like a blurred glass strip and consumed
          // map space on iPhone PWAs. A solid header plus the native inset is
          // enough to keep the status area clear without covering content.
          height: 'calc(48px + env(safe-area-inset-top))',
          minHeight: 'calc(48px + env(safe-area-inset-top))',
          padding: 'env(safe-area-inset-top) 16px 0',
        }}
        className={`${styles.header} ${styles.appHeader} ${hideHeader || (autoHideHeader && !headerVisible) ? styles.headerHidden : ''}`}
      >
        {isStack ? (
          <Link href={backHref || '/driver'} className={styles.headerIcon} aria-label={backLabel || t.drvBack || 'Back'}>
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
        {rightSlot || (!mapOpen ? <NotificationBell /> : <span aria-hidden="true" />)}
      </header>

      <section data-driver-screen={active} className={`${styles.content} ${flush ? styles.contentFlush : ''} ${active === 'today' ? styles.contentToday : ''}`}>{children}</section>

      <nav className={`${styles.nav} ${hideNav ? styles.navHidden : ''}`} aria-label={localeLabel(t, 'nav')}>
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
        <strong>{localeLabel(t, 'rotateTitle')}</strong>
        <span>{localeLabel(t, 'rotateBody')}</span>
      </aside>
    </main>
  )
}

function localeLabel(t: Record<string, string>, key: 'nav' | 'rotateTitle' | 'rotateBody') {
  const spanish = t.drvToday === 'Hoy'
  const french = t.drvToday === "Aujourd'hui"
  const labels = spanish
    ? {nav: 'Navegación de Driver', rotateTitle: 'Gira tu dispositivo', rotateBody: 'RouteHub Driver está diseñado para usarse en vertical.'}
    : french
      ? {nav: 'Navigation Driver', rotateTitle: 'Tournez votre appareil', rotateBody: 'RouteHub Driver est conçu pour le mode portrait.'}
      : {nav: 'Driver navigation', rotateTitle: 'Rotate your device', rotateBody: 'RouteHub Driver is designed for portrait mode.'}
  return labels[key]
}
