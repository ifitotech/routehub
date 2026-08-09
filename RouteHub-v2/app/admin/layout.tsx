'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import styles from './admin.module.css'

export default function AdminLayout({children}: {children: React.ReactNode}) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getSupabase().auth.getSession().then(({data}) => {
      if (!data.session) router.replace('/login')
      else setReady(true)
    })
  }, [router])

  if (ready) return <>{children}</>
  return <main className="app"><div className={`${styles.page} ${styles.loadingPage}`}><section className={styles.loadingCard}><div className={styles.loader}/><p>Loading secure workspace…</p></section></div></main>
}
