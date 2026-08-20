'use client'

import {useEffect, useState} from 'react'
import {usePathname, useRouter} from 'next/navigation'
import {getSupabase} from '../lib/supabase'
import {canOpenPath, resolveAccess, workspaceForStrictRole} from './auth-access'

const publicPaths = ['/login', '/auth/callback', '/product', '/how-it-works', '/for-drivers']

export default function AuthBoundary({children}: {children: React.ReactNode}) {
  const pathname = usePathname()
  const router = useRouter()
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null)

  useEffect(() => {
    const client = getSupabase()
    const isPublic = pathname === '/' || publicPaths.some(path => pathname.startsWith(path))
    let active = true
    const verify = async () => {
      if (isPublic) return
      try {
        const access = await resolveAccess(client)
        if (!canOpenPath(access.role, pathname)) { router.replace(workspaceForStrictRole(access.role)); return }
        if (active) setVerifiedPath(pathname)
      } catch (error) {
        if (error instanceof Error && error.message !== 'AUTH_REQUIRED') sessionStorage.setItem('routehub_auth_error', error.message)
        router.replace('/login')
      }
    }
    void verify()
    const {data: listener} = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { setVerifiedPath(null); router.replace('/login') }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') void verify()
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [pathname, router])

  const isPublic = pathname === '/' || publicPaths.some(path => pathname.startsWith(path))
  if (!isPublic && verifiedPath !== pathname) return <main className="app"><section className="card" style={{marginTop: 72, textAlign: 'center'}}><h1>RouteHub</h1><p className="muted" role="status">Opening your secure workspace…</p></section></main>
  return <>{children}</>
}
