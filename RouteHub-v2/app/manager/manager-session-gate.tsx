'use client'

import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {Route} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'

function loginTarget() {
  const installed = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone)
  return installed ? '/login?source=pwa&app=manager' : '/login'
}

export default function ManagerSessionGate({children}:{children:React.ReactNode}) {
  const router = useRouter()
  const {locale} = useLocale()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    let decided = false
    const client = getSupabase()
    const decide = (hasSession:boolean) => {
      if (!active || decided) return
      decided = true
      if (hasSession) setReady(true)
      else router.replace(loginTarget())
    }
    void client.auth.getSession().then(({data}) => { if (data.session) decide(true) }).catch(() => {})
    const {data:{subscription}} = client.auth.onAuthStateChange((_event, session) => decide(Boolean(session)))
    const timeout = window.setTimeout(() => decide(false), 8000)
    return () => { active = false; window.clearTimeout(timeout); subscription.unsubscribe() }
  }, [router])

  if (ready) return <>{children}</>
  return <div className="driver-v3-splash" role="status" aria-live="polite" aria-label={locale === 'es' ? 'Cargando RouteHub Manager' : locale === 'fr' ? 'Chargement de RouteHub Manager' : 'Loading RouteHub Manager'}>
    <div className="driver-v3-splash-loader" aria-hidden="true">
      <span className="driver-v3-splash-track" />
      <span className="driver-v3-splash-truck"><Route size={30} strokeWidth={2.2}/></span>
    </div>
  </div>
}
