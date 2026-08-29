import Link from 'next/link'
'use client'

import {Home, List, MapPin, MoreHorizontal} from 'lucide-react'
import {usePathname,useSearchParams} from 'next/navigation'
import {useLocale} from '../../lib/use-preferences'
import styles from './driver.module.css'

/** Shared navigation for every Driver workspace screen. */
export default function DriverBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const {t} = useLocale()
  const isHome = pathname === '/driver'

  const view=searchParams.get('view')
  return <nav className={styles.driverNav} aria-label="Driver navigation">
    <Link href="/driver" aria-current={isHome&&!view ? 'page' : undefined}><Home size={18}/><span>Today</span></Link>
    <Link href="/driver?view=route" aria-current={pathname === '/driver'&&view==='route' ? 'page' : undefined}><List size={18}/><span>Route</span></Link>
    <Link href="/driver?view=map" aria-current={pathname === '/driver'&&view==='map' ? 'page' : undefined}><MapPin size={18}/><span>Map</span></Link>
    <Link href="/driver/more" aria-current={pathname === '/driver/more' ? 'page' : undefined}><MoreHorizontal size={18}/><span>More</span></Link>
  </nav>
}
