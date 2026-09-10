'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useEffect} from 'react'
import {ChevronLeft, History, Home, Map as MapIcon, Settings, Truck, UserRound} from 'lucide-react'
import shellA from './driver-v3-a.module.css'
import shellB from './driver-v3-b.module.css'
import './driver-route-swipe.css'
import {applyThemePreference,useLocale} from '../../lib/use-preferences'

const styles = {...shellA, ...shellB}

type Tab = 'today' | 'route' | 'map' | 'history' | 'truck' | 'more'

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
  swipeDownTo?: string
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
  swipeDownTo,
}: Props) {
  const {t} = useLocale()
  useEffect(()=>{applyThemePreference('light')},[])
  const pathname = usePathname()
  const isStack = mode === 'stack'
  const profileOpen = pathname === '/driver/more' || pathname.startsWith('/driver/more/')
  const menuHref = profileOpen ? '/driver' : '/driver/more'
  const mapOpen = pathname === '/driver/map'

  return (
    <main className={styles.shell}>
      <header className={`${styles.header} ${styles.appHeader}`}>
        {isStack ? (
          <Link href={backHref || '/driver'} className={styles.headerIcon} aria-label={backLabel}>
            <ChevronLeft size={22} strokeWidth={2.4} />
          </Link>
        ) : (
          <Link href={mapOpen ? '/driver' : '/driver/map'} className={styles.headerIcon} aria-label={mapOpen ? (t.drvToday || 'Today') : (t.drvMap || 'Map')}>
            <MapIcon size={22} strokeWidth={2.2} />
          </Link>
        )}
        <Link href="/driver" className={styles.headerBrand}>
          <img src="/routehub-driver-new.jpg" alt="" width={32} height={32} />
          <span>RouteHub</span>
        </Link>
        <Link href={menuHref} className={styles.headerIcon} aria-label={t.drvProfile}>
          <UserRound color="#fff" strokeWidth={2.2} />
        </Link>
      </header>

      <section className={`${styles.content} ${flush ? styles.contentFlush : ''}`}>{children}</section>

      <nav className={`${styles.nav} ${hideNav ? styles.navHidden : ''}`} aria-label="Driver navigation">
        <Link className={active === 'today' || active === 'route' ? styles.active : ''} href="/driver">
          <Home />
          <span>{t.drvToday}</span>
        </Link>
        <Link className={active === 'history' || active === 'route' ? styles.active : ''} href="/driver/history">
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
    </main>
  )
}
