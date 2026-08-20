'use client'

import Link from 'next/link'
import {CircleUserRound, History as HistoryIcon, Home, List} from 'lucide-react'
import {usePathname} from 'next/navigation'
import {useLocale} from '../../lib/use-preferences'
import styles from './driver.module.css'

/** Shared navigation for every Driver workspace screen. */
export default function DriverBottomNav() {
  const pathname = usePathname()
  const {t} = useLocale()
  const isHome = pathname === '/driver'

  return <nav className={styles.driverNav} aria-label="Driver navigation">
    <Link href="/driver" aria-current={isHome ? 'page' : undefined}><Home size={18}/><span>{t.home}</span></Link>
    <Link href="/driver" aria-label="Route"><List size={18}/><span>Route</span></Link>
    <Link href="/driver/history" aria-current={pathname === '/driver/history' ? 'page' : undefined}><HistoryIcon size={18}/><span>{t.history}</span></Link>
    <Link href="/driver/settings" aria-current={pathname === '/driver/settings' ? 'page' : undefined}><CircleUserRound size={18}/><span>Profile</span></Link>
  </nav>
}
