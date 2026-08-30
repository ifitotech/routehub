'use client'

import Link from 'next/link'
import {Bell, Home, List, Map, Menu, MoreHorizontal, Truck} from 'lucide-react'
import styles from './driver-v3.module.css'

export default function DriverV3Shell({children, active, headerStatus}: {children: React.ReactNode; active: 'today'|'route'|'map'|'truck'|'more'; headerStatus?: string}) {
  return <main className={styles.shell}>
    {active==='today'?<header className={`${styles.header} ${styles.todayHeader}`}>
      <Link href="/driver/more" className={styles.headerIcon} aria-label="Open menu"><Menu/></Link>
      <Link href="/driver" className={styles.todayBrand}>RouteHub Driver</Link>
      <button className={styles.headerIcon} aria-label="Notifications"><Bell/></button>
      {headerStatus&&<span className={styles.headerStatus}>{headerStatus}</span>}
    </header>:<header className={styles.header}><Link href="/driver" className={styles.brand}><img src="/routehub-driver-new.jpg" alt=""/><span>RouteHub <small>DRIVER</small></span></Link><button className={styles.iconButton} aria-label="Notifications"><Bell size={19}/></button></header>}
    <section className={styles.content}>{children}</section>
    <nav className={styles.nav} aria-label="Driver navigation">
      <Link className={active==='today'?styles.active:''} href="/driver"><Home/><span>Today</span></Link>
      <Link className={active==='route'?styles.active:''} href="/driver/route"><List/><span>Route</span></Link>
      <Link className={active==='map'?styles.active:''} href="/driver/map"><Map/><span>Map</span></Link>
      <Link className={active==='truck'?styles.active:''} href="/driver/truck"><Truck/><span>Truck</span></Link>
      <Link className={active==='more'?styles.active:''} href="/driver/more"><MoreHorizontal/><span>More</span></Link>
    </nav>
  </main>
}
