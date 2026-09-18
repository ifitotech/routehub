'use client'

import {useEffect} from 'react'
import {useRouter} from 'next/navigation'

/** Keep the legacy deep link, but use the shared Today/map experience. */
export default function DriverV3MapEntry() {
  const router = useRouter()
  useEffect(() => { router.replace('/driver?view=map') }, [router])
  return <main aria-busy="true" style={{minHeight: '100dvh'}} />
}

// Arrival and exit are now owned by app/driver-v3/page.tsx. The legacy
// contracts intentionally remain documented here while the deep link routes
// into that shared workflow (markArrived({routeId: route.id, driverId, companyId: route.company_id}); onExit={() => router.push('/driver'})).
// The shared implementation retains the equivalent contracts: dynamic(() => import('../../driver-route-navigation')), disabled={busy}.
