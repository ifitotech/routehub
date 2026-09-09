'use client'

import Link from 'next/link'
import {usePathname,useRouter} from 'next/navigation'
import {useEffect,useRef} from 'react'
import {ChevronLeft, History, Home, Settings, Truck, UserRound} from 'lucide-react'
import styles from './driver-v3.module.css'
import {applyThemePreference,useLocale} from '../../lib/use-preferences'

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
  swipeDownTo?: string
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
  swipeDownTo,
}: Props) {
  const {t} = useLocale()
  useEffect(()=>{applyThemePreference('light')},[])
  const pathname = usePathname()
  const router = useRouter()
  const isStack = mode === 'stack'
  const profileOpen = pathname === '/driver/more' || pathname.startsWith('/driver/more/')
  const menuHref = profileOpen ? '/driver' : '/driver/more'
  const swipeStart=useRef<number|null>(null)
  const navigateWithTransition=(path:string)=>{
    if(typeof document!=='undefined'&&'startViewTransition' in document){
      ;(document as Document & {startViewTransition?:(callback:()=>void)=>unknown}).startViewTransition?.(()=>router.push(path))
    }else router.push(path)
  }

  return (
    <main className={styles.shell}>
      <header className={`${styles.header} ${styles.appHeader}`}>
        {isStack ? (
          <Link href={backHref || '/driver'} className={styles.headerIcon} aria-label={backLabel}>
            <ChevronLeft size={22} strokeWidth={2.4} />
          </Link>
        ) : <span className={styles.headerIcon} aria-hidden="true" />}
        <Link href="/driver" className={styles.headerBrand}>
          <img src="/routehub-driver-new.jpg" alt="" width={32} height={32} />
          <span>RouteHub</span>
        </Link>
        <Link href={menuHref} className={styles.headerIcon} aria-label={t.drvProfile}>
          <UserRound color="#fff" strokeWidth={2.2} />
        </Link>
      </header>

      <section
        className={`${styles.content} ${flush ? styles.contentFlush : ''}`}
        onTouchStart={event=>{swipeStart.current=event.touches[0]?.clientY??null}}
        onTouchEnd={event=>{
          if(!swipeDownTo||swipeStart.current==null)return
          const delta=event.changedTouches[0]?.clientY-swipeStart.current
          swipeStart.current=null
          if(delta>70)navigateWithTransition(swipeDownTo)
        }}
      >{children}</section>

      <nav className={`${styles.nav} ${hideNav ? styles.navHidden : ''}`} aria-label="Driver navigation">
        <Link className={active === 'today' || active === 'route' ? styles.active : ''} href="/driver">
          <Home />
          <span>{t.drvToday}</span>
        </Link>
        <Link className={active === 'history' || active === 'route' ? styles.active : ''} href="/driver/history">
          <History />
          <span>{t.routes || 'Routes'}</span>
        </Link>
        <Link className={active === 'truck' ? styles.active : ''} href="/driver/truck">
          <Truck />
          <span>{t.drvTruck}</span>
        </Link>
        <Link className={active === 'more' ? styles.active : ''} href="/driver/settings">
          <Settings />
          <span>{t.drvMore || 'More'}</span>
        </Link>
      </nav>
    </main>
  )
}
