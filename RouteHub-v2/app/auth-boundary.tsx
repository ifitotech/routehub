'use client'

import {useEffect, useState} from 'react'
import {usePathname, useRouter} from 'next/navigation'
import {getSupabase} from '../lib/supabase'
import {canOpenPath, resolveAccess, workspaceForStrictRole} from './auth-access'

// Invitation activation must be public: a manager has no session yet when
// opening the email link for the first time.
const publicPaths = ['/login', '/auth/callback', '/activate-invitation', '/product', '/how-it-works', '/for-drivers', '/terms']

function isDriverWorkspace(path: string) {
  return path === '/driver' || path.startsWith('/driver/') || path === '/driver-v3' || path.startsWith('/driver-v3/')
}

function sameWorkspace(a: string | null, b: string) {
  if (!a) return false
  if (isDriverWorkspace(a) && isDriverWorkspace(b)) return true
  // Stay mounted across sibling pages in the same role area
  const root = (p: string) => p.split('/').slice(0, 2).join('/') || '/'
  return root(a) === root(b)
}

export default function AuthBoundary({children}: {children: React.ReactNode}) {
  const pathname = usePathname()
  const router = useRouter()
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null)
  const [verifiedRoleOk, setVerifiedRoleOk] = useState(false)

  useEffect(() => {
    const client = getSupabase()
    const isPublic = pathname === '/' || publicPaths.some(path => pathname.startsWith(path))
    let active = true
    const verify = async () => {
      if (isPublic) return
      try {
        const access = await resolveAccess(client)
        if (!canOpenPath(access.role, pathname)) {
          router.replace(workspaceForStrictRole(access.role))
          return
        }
        if (active) {
          setVerifiedPath(pathname)
          setVerifiedRoleOk(true)
        }
      } catch (error) {
        if (error instanceof Error && error.message !== 'AUTH_REQUIRED') {
          sessionStorage.setItem('routehub_auth_error', error.message)
        }
        router.replace('/login')
      }
    }
    void verify()
    const {data: listener} = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        setVerifiedPath(null)
        setVerifiedRoleOk(false)
        router.replace('/login')
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') void verify()
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [pathname, router])

  const isPublic = pathname === '/' || publicPaths.some(path => pathname.startsWith(path))

  // First load / hard navigation still waits for auth.
  // Soft navigations inside the same workspace keep the current tree mounted
  // so Driver V3 does not flash a website-style "Opening…" card between tabs.
  if (!isPublic && verifiedPath !== pathname) {
    if (verifiedRoleOk && sameWorkspace(verifiedPath, pathname)) {
      return <>{children}</>
    }
    if (isDriverWorkspace(pathname)) {
      return (
        <div className="driver-v3-splash" role="status" aria-live="polite">
          <img src="/routehub-driver-new.jpg" alt="" width={72} height={72} />
          <strong>RouteHub Driver</strong>
          <p>Opening your workspace…</p>
          <div className="spin" aria-hidden="true" />
        </div>
      )
    }
    return (
      <main className="app">
        <section className="card" style={{marginTop: 72, textAlign: 'center'}}>
          <h1>RouteHub</h1>
          <p className="muted" role="status">
            Opening your secure workspace…
          </p>
        </section>
      </main>
    )
  }

  return <>{children}</>
}
