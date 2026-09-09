'use client'

import Link from 'next/link'
import {ChevronLeft, History, Home, UserRound} from 'lucide-react'
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
  const isStack = mode === 'stack'

  return (
    <main className={styles.shell}>
      <header className={`${styles.header} ${styles.appHeader}`}>
        {isStack ? (
          <Link href={backHref || '/driver'} className={styles.headerIcon} aria-label={backLabel}>
            <ChevronLeft size={22} strokeWidth={2.4} />
          </Link>
        ) : <span className={styles.headerSpacer} aria-hidden="true" />}
        <Link href="/driver" className={styles.headerBrand}>
          <span>RouteHub Driver</span>
        </Link>
        {isStack?<span className={styles.headerSpacer} aria-hidden="true" />:<span className={styles.headerStatus}>{headerStatus}</span>}
      </header>

      <section className={`${styles.content} ${flush ? styles.contentFlush : ''}`}>{children}</section>

      <nav className={`${styles.nav} ${hideNav ? styles.navHidden : ''}`} aria-label="Driver navigation">
        <Link className={active === 'today' || active === 'route' ? styles.active : ''} href="/driver">
          <Home />
          <span>{t.drvToday}</span>
        </Link>
        <Link className={active === 'history' || active === 'route' ? styles.active : ''} href="/driver/history">
          <History />
          <span>{t.drvHistory || 'History'}</span>
        </Link>
        <Link className={active === 'more' ? styles.active : ''} href="/driver/settings">
          <UserRound />
          <span>{t.drvProfile || 'Profile'}</span>
        </Link>
      </nav>
    </main>
  )
}
