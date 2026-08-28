'use client'

import Link from 'next/link'
import {Home, List, Map as MapIcon, MoreHorizontal} from 'lucide-react'
import {usePathname} from 'next/navigation'
import {useLocale} from '../../lib/use-preferences'
import styles from './driver.module.css'

/** Shared navigation for every Driver workspace screen. */
export default function DriverBottomNav() {
  const pathname = usePathname()
  const {t} = useLocale()
  const isHome = pathname === '/driver'

  const isMap=pathname==='/driver' && typeof window!=='undefined' && new URLSearchParams(window.location.search).get('view')==='map'
  return <nav className={styles.driverNav} aria-label="Driver navigation">
    <Link href="/driver" aria-current={isHome&&!isMap ? 'page' : undefined}><Home size={18}/><span>Today</span></Link>
    <Link href="/driver?view=map" aria-current={isMap ? 'page' : undefined}><MapIcon size={18}/><span>Map</span></Link>
    <Link href="/driver?view=route" aria-current={pathname === '/driver'&&!isHome ? 'page' : undefined}><List size={18}/><span>Route</span></Link>
    <Link href="/driver/settings"><MoreHorizontal size={18}/><span>More</span></Link>
  </nav>
}
