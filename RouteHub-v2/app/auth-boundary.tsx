'use client'

import {useEffect, useRef, useState} from 'react'
import {usePathname, useRouter} from 'next/navigation'
import {getSupabase} from '../lib/supabase'
import {canOpenPath, resolveAccess, workspaceForStrictRole} from './auth-access'

// Invitation activation must be public: a manager has no session yet when
// opening the email link for the first time.
const publicPaths = ['/login', '/auth/callback', '/activate-invitation', '/product', '/how-it-works', '/for-drivers', '/terms', '/privacy', '/guide.html']

function isDriverWorkspace(path: string) {
  return path === '/driver' || path.startsWith('/driver/') || path === '/driver-v3' || path.startsWith('/driver-v3/')
}

function sameWorkspace(a: string | null, b: string) {
  if (!a) return false
  if (isDriverWorkspace(a) && isDriverWorkspace(b)) return true
  const root = (p: string) => p.split('/').slice(0, 2).join('/') || '/'
  return root(a) === root(b)
}

export default function AuthBoundary({children}: {children: React.ReactNode}) {
  const pathname = usePathname()
  const router = useRouter()
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null)
  const [verifiedRoleOk, setVerifiedRoleOk] = useState(false)
  // Tracks whether Supabase has resolved its initial auth state at least
  // once in this app session (see the comment below) - a ref, not state,
  // since it must survive across pathname changes without itself
  // triggering a re-render.
  const authInitialized = useRef(false)

  useEffect(() => {
    const client = getSupabase()
    const isPublic = pathname === '/' || publicPaths.some(path => pathname.startsWith(path))
    let active = true
    let initTimeout: number | undefined
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
        if (active) router.replace('/login')
      }
    }
    // Warm starts already have a persisted session. Let the current workspace
    // paint while role verification completes in the background; invalid or
    // expired sessions are still redirected by verify().
    if (!isPublic) {
      void client.auth.getSession().then(({data}) => {
        if (active && data.session && verifiedPath === null) {
          setVerifiedPath(pathname)
          setVerifiedRoleOk(true)
        }
      }).catch(() => {})
    }
    // Calling verify() eagerly on a cold app launch (an installed PWA
    // reopened from fully closed) can race Supabase rehydrating the
    // persisted session from storage: resolveAccess()'s getUser() call
    // then has no token to send and looks unauthenticated even though a
    // valid session exists, bouncing straight to /login - which is what
    // was producing the visible flash before landing back on the real
    // workspace. onAuthStateChange's first callback reflects the session
    // Supabase actually resolved after checking storage, so the very first
    // verify() in this app session waits for that instead of firing blind.
    // Once initialized, later pathname changes verify immediately as
    // before - there's no cold-start race left to wait out.
    const {data: listener} = client.auth.onAuthStateChange(event => {
      if (!active) return
      if (!authInitialized.current) {
        authInitialized.current = true
        void verify()
        return
      }
      if (event === 'SIGNED_OUT') {
        setVerifiedPath(null)
        setVerifiedRoleOk(false)
        router.replace('/login')
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') void verify()
    })
    if (authInitialized.current) {
      void verify()
    } else if (!isPublic) {
      // Safety net: if onAuthStateChange never fires for some reason, this
      // would otherwise wait on the loading UI forever instead of just
      // falling back to sign-in like it did before this fix.
      initTimeout = window.setTimeout(() => {
        if (!active || authInitialized.current) return
        authInitialized.current = true
        router.replace('/login')
      }, 8000)
    }
    return () => {
      active = false
      listener.subscription.unsubscribe()
      if (initTimeout) window.clearTimeout(initTimeout)
    }
  }, [pathname, router])

  const isPublic = pathname === '/' || publicPaths.some(path => pathname.startsWith(path))

  if (!isPublic && verifiedPath !== pathname) {
    if (verifiedRoleOk && sameWorkspace(verifiedPath, pathname)) {
      return <>{children}</>
    }
    if (isDriverWorkspace(pathname)) {
      return (
        <div className="driver-v3-splash" role="status" aria-live="polite">
          <img className="driver-v3-splash-hero" src="/driver-empty-route-hero.png" alt="" />
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
