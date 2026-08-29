'use client'

import Link from 'next/link'
import {ChevronRight,Clock3,History,Settings,Truck} from 'lucide-react'
import DriverBottomNav from '../driver-bottom-nav'
import styles from './more.module.css'

export default function DriverMore(){
  return <main className={`app driver-dashboard ${styles.page}`}>
    <header className={styles.header}><Link className={styles.brand} href="/driver">RouteHub</Link></header>
    <p className={styles.eyebrow}>Driver workspace</p><h1>More</h1>
    <section className={styles.section}><p className={styles.sectionLabel}>WORK</p><Link className={styles.row} href="/driver"><span className={styles.icon}><Clock3 size={21}/></span><span><strong>Driving Day</strong><small>Start or end your driving day</small></span><ChevronRight size={19}/></Link><Link className={styles.row} href="/driver?view=truck"><span className={styles.icon}><Truck size={21}/></span><span><strong>Truck</strong><small>Fuel and maintenance</small></span><ChevronRight size={19}/></Link></section>
    <section className={styles.section}><p className={styles.sectionLabel}>ACTIVITY</p><Link className={styles.row} href="/driver/history"><span className={styles.icon}><History size={21}/></span><span><strong>Route history</strong><small>Completed routes and issues</small></span><ChevronRight size={19}/></Link></section>
    <section className={styles.section}><p className={styles.sectionLabel}>ACCOUNT</p><Link className={styles.row} href="/driver/settings"><span className={styles.icon}><Settings size={21}/></span><span><strong>Settings</strong><small>Profile, language and notifications</small></span><ChevronRight size={19}/></Link></section>
    <DriverBottomNav/>
  </main>
}
