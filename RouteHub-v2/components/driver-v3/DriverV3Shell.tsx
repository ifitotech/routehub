'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {ChevronLeft, History, Home, Map as MapIcon, Menu, MoreHorizontal, Truck} from 'lucide-react'
import styles from './driver-v3.module.css'
import {useLocale} from '../../lib/use-preferences'

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
}: Props) {
  const {t} = useLocale()
  const pathname = usePathname()
  const isStack = mode === 'stack'
  const profileOpen = pathname === '/driver/more' || pathname.startsWith('/driver/more/')
  const menuHref = profileOpen ? '/driver' : '/driver/more'

  return (
    <main className={styles.shell}>
      <header className={`${styles.header} ${styles.appHeader}`}>
        {isStack ? (
          <Link href={backHref || '/driver'} className={styles.headerIcon} aria-label={backLabel}>
            <ChevronLeft size={22} strokeWidth={2.4} />
          </Link>
        ) : (
          <Link href={menuHref} className={styles.headerIcon} aria-label={t.drvProfile}>
            <MapIcon color="#fff" strokeWidth={2.2} />
          </Link>
        )}
        <Link href="/driver" className={styles.headerBrand}>
          <img src="/routehub-driver-new.jpg" alt="" width={32} height={32} />
          <span>RouteHub</span>
        </Link>
        <Link href={menuHref} className={styles.headerIcon} aria-label={t.drvProfile}>
          <Menu color="#fff" strokeWidth={2.2} />
        </Link>
      </header>

      <section className={`${styles.content} ${flush ? styles.contentFlush : ''}`}>{children}</section>

      <nav className={`${styles.nav} ${hideNav ? styles.navHidden : ''}`} aria-label="Driver navigation">
        <Link className={active === 'today' || active === 'route' ? styles.active : ''} href="/driver">
          <Home />
          <span>{t.drvToday}</span>
        </Link>
        <Link className={active === 'map' ? styles.active : ''} href="/driver/map">
          <MapIcon />
          <span>{t.drvMap || 'Map'}</span>
        </Link>
        <Link className={active === 'history' ? styles.active : ''} href="/driver/history">
          <History />
          <span>{t.drvHistory || t.history || 'History'}</span>
        </Link>
        <Link className={active === 'truck' ? styles.active : ''} href="/driver/truck">
          <Truck />
          <span>{t.drvTruck}</span>
        </Link>
        <Link className={active === 'more' ? styles.active : ''} href="/driver/more">
          <MoreHorizontal />
          <span>{t.drvMore || 'More'}</span>
        </Link>
      </nav>
    </main>
  )
}
