'use client'

import {useEffect} from 'react'
import {useRouter} from 'next/navigation'

// "More" and "Settings" were two views of the same thing. Settings now owns
// every group (Profile, Branch, Preferences, Notifications, App, Operations,
// Plan, Support), so this route simply forwards there. Kept as a redirect so
// existing links, bookmarks and notifications do not break.
export default function ManagerMorePage() {
  const router = useRouter()
  useEffect(() => { router.replace('/settings') }, [router])
  return null
}
