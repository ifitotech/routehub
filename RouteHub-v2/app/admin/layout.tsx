'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import styles from './admin.module.css'

export default function AdminLayout({children}: {children: React.ReactNode}) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const check = async () => {
      const supabase = getSupabase()
      const {data} = await supabase.auth.getSession()
      if (!data.session) { router.replace('/login'); return }
      const {data: admin, error} = await supabase.from('platform_admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle()
      if (error || !admin) { router.replace('/'); return }
      setReady(true)
    }
    void check()
  }, [router])

  if (ready) return <>{children}</>
  return <main className="app"><div className={`${styles.page} ${styles.loadingPage}`}><section className={styles.loadingCard}><div className={styles.loader}/><p>Loading secure workspace…</p></section></div></main>
}
