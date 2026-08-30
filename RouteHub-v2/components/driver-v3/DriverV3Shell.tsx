'use client'

import Link from 'next/link'
import {Bell, ChevronLeft, Home, List, Map, Menu, MoreHorizontal, Truck} from 'lucide-react'
import styles from './driver-v3.module.css'

type Tab = 'today' | 'route' | 'map' | 'truck' | 'more'

type Props = {
  children: React.ReactNode
  active: Tab
  /** Primary tab screens show branding; stack screens show compact ← Back + title */
  mode?: 'tab' | 'stack'
  title?: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  headerStatus?: string
  /** Map tab can hide default content padding for full-bleed map */
  flush?: boolean
  /** Hide tab bar while a sheet/confirm is open so content is never clipped */
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
  const isToday = active === 'today' && mode === 'tab'
  const isStack = mode === 'stack'

  return (
    <main className={styles.shell}>
      {isToday ? (
        <header className={`${styles.header} ${styles.todayHeader}`}>
          <Link href="/driver/more" className={styles.headerIcon} aria-label="Open menu">
            <Menu />
          </Link>
          <Link href="/driver" className={styles.todayBrand}>
            RouteHub Driver
          </Link>
          <button type="button" className={styles.headerIcon} aria-label="Notifications">
            <Bell />
          </button>
          {headerStatus && <span className={styles.headerStatus}>{headerStatus}</span>}
        </header>
      ) : isStack ? (
        <header className={`${styles.header} ${styles.stackHeader}`}>
          <Link href={backHref || '/driver'} className={styles.backBtn} aria-label={backLabel}>
            <ChevronLeft size={22} strokeWidth={2.4} />
            <span>{backLabel}</span>
          </Link>
          <div className={styles.stackTitles}>
            <strong>{title || 'Details'}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
          <span className={styles.stackSpacer} aria-hidden="true" />
        </header>
      ) : (
        <header className={`${styles.header} ${styles.tabHeader}`}>
          <div className={styles.tabTitles}>
            <strong>{title || tabLabel(active)}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
          <button type="button" className={styles.iconButton} aria-label="Notifications">
            <Bell size={19} />
          </button>
        </header>
      )}

      <section className={`${styles.content} ${flush ? styles.contentFlush : ''}`}>{children}</section>

      <nav className={`${styles.nav} ${hideNav ? styles.navHidden : ''}`} aria-label="Driver navigation">
        <Link className={active === 'today' ? styles.active : ''} href="/driver">
          <Home />
          <span>Today</span>
        </Link>
        <Link className={active === 'route' ? styles.active : ''} href="/driver/route">
          <List />
          <span>Route</span>
        </Link>
        <Link className={active === 'map' ? styles.active : ''} href="/driver/map">
          <Map />
          <span>Map</span>
        </Link>
        <Link className={active === 'truck' ? styles.active : ''} href="/driver/truck">
          <Truck />
          <span>Truck</span>
        </Link>
        <Link className={active === 'more' ? styles.active : ''} href="/driver/more">
          <MoreHorizontal />
          <span>More</span>
        </Link>
      </nav>
    </main>
  )
}

function tabLabel(tab: Tab) {
  switch (tab) {
    case 'today':
      return 'Today'
    case 'route':
      return 'My Route'
    case 'map':
      return 'Map'
    case 'truck':
      return 'Truck'
    case 'more':
      return 'More'
  }
}
