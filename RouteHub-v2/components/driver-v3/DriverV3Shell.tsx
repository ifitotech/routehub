'use client'

import Link from 'next/link'
import {ChevronLeft, History, Home, Menu, Settings, Truck} from 'lucide-react'
import styles from './driver-v3.module.css'
import {useLocale} from '../../lib/use-preferences'

type Tab = 'today' | 'route' | 'map' | 'history' | 'truck' | 'more'

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
  const {t} = useLocale()
  const isToday = active === 'today' && mode === 'tab'
  const isStack = mode === 'stack'

  return (
    <main className={styles.shell}>
      {isToday ? (
        <header className={`${styles.header} ${styles.todayHeader}`}>
          <Link href="/driver/more" className={styles.headerIcon} aria-label={t.drvProfile}>
            <Menu />
          </Link>
          <Link href="/driver" className={styles.todayBrand}>
            RouteHub Driver
          </Link>
          {headerStatus ? <span className={styles.headerStatus}>{headerStatus}</span> : <span className={styles.headerIcon} aria-hidden="true" />}
        </header>
      ) : isStack ? (
        <header className={`${styles.header} ${styles.stackHeader}`}>
          <Link href={backHref || '/driver'} className={styles.backBtn} aria-label={backLabel}>
            <ChevronLeft size={22} strokeWidth={2.4} />
            <span>{backLabel}</span>
          </Link>
          <div className={styles.stackTitles}>
            <strong>{title || t.drvStopDetails}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
          <span className={styles.stackSpacer} aria-hidden="true" />
        </header>
      ) : (
        <header className={`${styles.header} ${styles.tabHeader}`}>
          <div className={styles.tabTitles}>
            <strong>{title || tabLabel(active, t)}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
<span className={styles.stackSpacer} aria-hidden="true" />
        </header>
      )}

      <section className={`${styles.content} ${flush ? styles.contentFlush : ''}`}>{children}</section>

      <nav className={`${styles.nav} ${hideNav ? styles.navHidden : ''}`} aria-label="Driver navigation">
        <Link className={active === 'today' || active === 'route' ? styles.active : ''} href="/driver">
          <Home />
          <span>{t.drvToday}</span>
        </Link>
        <Link className={active === 'history' ? styles.active : ''} href="/driver/history">
          <History />
          <span>{t.drvHistory || t.history || 'History'}</span>
        </Link>
        <Link className={active === 'truck' ? styles.active : ''} href="/driver/truck">
          <Truck />
          <span>{t.drvTruck}</span>
        </Link>
        <Link className={active === 'more' ? styles.active : ''} href="/driver/settings">
          <Settings />
          <span>{t.drvSettings}</span>
        </Link>
      </nav>
    </main>
  )
}

function tabLabel(tab: Tab, t: Record<string, string>) {
  switch (tab) {
    case 'today':
      return t.drvToday
    case 'route':
      return t.drvMyRoute
    case 'map':
      return t.drvMap
    case 'history':
      return t.drvHistory || t.drvRouteHistory
    case 'truck':
      return t.drvTruck
    case 'more':
      return t.drvSettings
  }
}
