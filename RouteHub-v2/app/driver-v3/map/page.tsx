'use client'

import {useEffect} from 'react'
import {useRouter} from 'next/navigation'

/** Keep the legacy deep link, but use the shared Today/map experience. */
export default function DriverV3MapEntry() {
  const router = useRouter()
  useEffect(() => { router.replace('/driver?view=map') }, [router])
  return <main aria-busy="true" style={{minHeight: '100dvh'}} />
}
