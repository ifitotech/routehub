import Link from 'next/link'
'use client'

import {Home, List, MoreHorizontal, Truck} from 'lucide-react'
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
  const isTruck=pathname==='/driver' && view==='truck'
  return <nav className={styles.driverNav} aria-label="Driver navigation">
    <Link href="/driver" aria-current={isHome&&!view ? 'page' : undefined}><Home size={18}/><span>Today</span></Link>
    <Link href="/driver?view=route" aria-current={pathname === '/driver'&&view==='route' ? 'page' : undefined}><List size={18}/><span>Route</span></Link>
    <Link href="/driver?view=truck" aria-current={isTruck ? 'page' : undefined}><Truck size={18}/><span>Truck</span></Link>
    <Link href="/driver/settings"><MoreHorizontal size={18}/><span>More</span></Link>
  </nav>
}
