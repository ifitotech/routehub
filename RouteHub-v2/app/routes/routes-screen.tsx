'use client'

import {useEffect} from 'react'
import {useRouter} from 'next/navigation'

export default function Routes() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/manager')
  }, [router])
  return null
}
