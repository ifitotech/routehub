'use client'
import {createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {currentMembership, currentUser} from '../data'
import {getSupabase} from '../supabase'
import {operationalDate} from '../driver-queue'
import {buildDriverSnapshot} from '../driver/driver-refresh'
import type {DriverV3Route} from './types'
import {getActiveDrivingSession, type DrivingSession} from '../driving-session'
import {createRealtimeRefresh} from '../realtime-sync'

type DriverV3Data = {
  routes: DriverV3Route[]
  driverId: string
  companyId: string
  companyPlan: string | null
  branchId: string | null
  branchName: string
  drivingSession: DrivingSession | null
  liveFix: {lat: number; lng: number; accuracy?: number; heading?: number | null; at: string} | null
  setLiveFix: (fix: {lat: number; lng: number; accuracy?: number; heading?: number | null; at: string} | null) => void
  loading: boolean
  error: string
  offline: boolean
  lastSyncedAt: number | null
  refresh: () => Promise<void>
  snapshot: ReturnType<typeof buildDriverSnapshot> | null
}

const DriverV3Context = createContext<DriverV3Data | null>(null)

const DRIVER_ROUTE_CACHE_TTL = 24 * 60 * 60 * 1000
// A driving session is operational history, not a live-GPS cache. A saved
// point is useful to Manager while it is fresh, but must never move a driver
// back to where they were hours ago when the PWA is reopened.
const LIVE_FIX_FRESHNESS_MS = 90_000
function freshSessionFix(session: DrivingSession | null) {
  if (session?.last_lat == null || session.last_lng == null) return null
  const timestamp = Date.parse(session.last_updated_at || '')
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > LIVE_FIX_FRESHNESS_MS) return null
  return {
    lat: Number(session.last_lat),
    lng: Number(session.last_lng),
    accuracy: session.last_accuracy ?? undefined,
    at: new Date(timestamp).toISOString(),
  }
}
function routeCacheKey(driverId: string, companyId: string) { return `routehub:driver-routes:v1:${companyId}:${driverId}` }
function membershipCacheKey(driverId: string) { return `routehub:driver-membership:v1:${driverId}` }
function readCachedRoutes(driverId: string, companyId: string): DriverV3Route[] {
  try {
    const raw = JSON.parse(localStorage.getItem(routeCacheKey(driverId, companyId)) || 'null')
    if (!raw || Date.now() - Number(raw.savedAt) > DRIVER_ROUTE_CACHE_TTL || !Array.isArray(raw.routes)) return []
    return raw.routes as DriverV3Route[]
  } catch { return [] }
}
function readCachedMembership(driverId: string): {companyId:string;branchId:string|null}|null {
  try {
    const raw = JSON.parse(localStorage.getItem(membershipCacheKey(driverId)) || 'null')
    if (!raw || Date.now() - Number(raw.savedAt) > DRIVER_ROUTE_CACHE_TTL || typeof raw.companyId !== 'string') return null
    return {companyId:raw.companyId,branchId:typeof raw.branchId==='string'?raw.branchId:null}
  } catch { return null }
}
function writeCachedMembership(driverId:string,companyId:string,branchId:string|null) {
  try { localStorage.setItem(membershipCacheKey(driverId),JSON.stringify({savedAt:Date.now(),companyId,branchId})) } catch { /* storage is optional */ }
}
function writeCachedRoutes(driverId: string, companyId: string, rows: DriverV3Route[]) {
  try { localStorage.setItem(routeCacheKey(driverId, companyId), JSON.stringify({savedAt: Date.now(), routes: rows})) } catch { /* storage is optional */ }
}

function useDriverDataInternal(): DriverV3Data {
  const [routes, setRoutes] = useState<DriverV3Route[]>([])
  const routesRef = useRef<DriverV3Route[]>([])
  const [driverId, setDriverId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [companyPlan, setCompanyPlan] = useState<string | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)
  const [branchName, setBranchName] = useState('')
  const [drivingSession, setDrivingSession] = useState<DrivingSession | null>(null)
  const [liveFix, setLiveFix] = useState<{lat: number; lng: number; accuracy?: number; heading?: number | null; at: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  const load = useCallback(async (quiet=false) => {
    if(!quiet) setLoading(true)
    setError('')
    let identity: {driverId: string; companyId: string} | null = null
    try {
      const user = await currentUser()
      const membership = await currentMembership()
      identity = {driverId: user.id, companyId: membership.company_id}
      setDriverId(user.id)
      setCompanyId(membership.company_id)
      setBranchId(membership.branch_id ?? null)
      writeCachedMembership(user.id,membership.company_id,membership.branch_id??null)
      if (membership.branch_id) {
        void getSupabase().from('branches').select('name').eq('id', membership.branch_id).maybeSingle()
          .then(({data}) => setBranchName(typeof data?.name === 'string' ? data.name : ''))
      }
      // Plan access is read-only product configuration. Do not make a route
      // refresh fail if an older workspace policy has not exposed this field.
      void getSupabase().from('companies').select('plan').eq('id', membership.company_id).maybeSingle()
        .then(({data}) => setCompanyPlan(typeof data?.plan === 'string' ? data.plan : null))
      const first = await getSupabase()
        .from('routes')
        .select('id,company_id,branch_id,driver_id,route_date,status,position,mission_type,origin_address,origin_lat,origin_lng,destination_name,destination_address,destination_phone,destination_contact_name,destination_lat,destination_lng,order_number,notes,driver_note,scheduled_at,arrived_at,completed_at,route_started_at,route_completed_at,completion_photo_path,customer_signature_path,finalized_at')
        .eq('company_id', membership.company_id)
        .eq('driver_id', user.id)
        .order('position', {ascending: true})
      let rows = first.data
      let loadError = first.error
      if (loadError && /route_number|destination_contact_name|schema cache|column/i.test(loadError.message || '')) {
        const second = await getSupabase()
          .from('routes')
          .select('id,company_id,branch_id,driver_id,route_date,status,position,mission_type,origin_address,origin_lat,origin_lng,destination_name,destination_address,destination_phone,destination_lat,destination_lng,order_number,notes,driver_note,scheduled_at,arrived_at,completed_at,route_started_at,route_completed_at,completion_photo_path,customer_signature_path,finalized_at')
          .eq('company_id', membership.company_id)
          .eq('driver_id', user.id)
          .order('position', {ascending: true})
        rows = second.data
          ? second.data.map(row => ({
              ...row,
              destination_contact_name: null,
            }))
          : null
        loadError = second.error
        // Last-resort compatibility path for projects whose PostgREST schema
        // cache is behind the deployed migrations. The driver only needs the
        // authoritative route row; optional fields are rendered defensively.
        if (loadError) {
          const fallback = await getSupabase()
            .from('routes')
            .select('*')
            .eq('company_id', membership.company_id)
            .eq('driver_id', user.id)
            .order('position', {ascending: true})
          rows = fallback.data
          loadError = fallback.error
        }
      }
      if (loadError) throw loadError
      routesRef.current = (rows || []) as DriverV3Route[]
      setRoutes(routesRef.current)
      setOffline(false)
      setLastSyncedAt(Date.now())
      writeCachedRoutes(user.id, membership.company_id, routesRef.current)
      // A driving-session/GPS problem must not hide an otherwise valid route.
      // The route remains usable and the session can be recovered on the next
      // focus/refresh once the protected session table is available.
      let session = await getActiveDrivingSession(user.id)
      setDrivingSession(session.data)
      // Only a confirmed recent point can be drawn as the driver. If the
      // app has been closed/backgrounded, the navigation hook clears this
      // and asks the device for a fresh foreground fix instead.
      setLiveFix(freshSessionFix(session.data))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to load Driver workspace.'
      if (!identity) {
        // Auth.getSession reads Supabase's persisted local session without a
        // network request. Use it only to find this device's scoped snapshot;
        // all mutations and role checks still require server verification.
        try {
          const {data:{session}} = await getSupabase().auth.getSession()
          const persistedUserId = session?.user?.id
          const cachedMembership = persistedUserId ? readCachedMembership(persistedUserId) : null
          if (persistedUserId && cachedMembership) {
            identity={driverId:persistedUserId,companyId:cachedMembership.companyId}
            setDriverId(persistedUserId)
            setCompanyId(cachedMembership.companyId)
            setBranchId(cachedMembership.branchId)
          }
        } catch { /* offline mode has no authenticated snapshot to show */ }
      }
      const cached = routesRef.current.length ? routesRef.current : identity ? readCachedRoutes(identity.driverId, identity.companyId) : []
      if (cached.length) {
        // A wide workspace refresh may fail because of an optional field or a
        // resumed mobile connection. Reconcile the cached rows with a minimal
        // authoritative query so cancelled/deleted/completed work can never
        // remain presented as the current operation indefinitely.
        try {
          const authority = await getSupabase()
            .from('routes')
            .select('id,status,completed_at,finalized_at,updated_version')
            .in('id', cached.map(route => route.id))
          if (authority.error) throw authority.error
          const byId = new Map((authority.data || []).map(row => [row.id, row]))
          routesRef.current = cached.flatMap(route => {
            const current = byId.get(route.id)
            return current ? [{...route, ...current} as DriverV3Route] : []
          })
          setRoutes(routesRef.current)
          setError('')
          setOffline(true)
        } catch {
          routesRef.current = cached
          setRoutes(cached)
          setError('')
          setOffline(true)
        }
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if(!driverId||!companyId) return
    const client = getSupabase()
    const sync = createRealtimeRefresh(() => load(true), 150)
    const channel = client
      .channel(`driver-v3-routes-${driverId}-${companyId}`)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'routes', filter: `driver_id=eq.${driverId}`}, payload => {
        const changed = payload.new as Partial<DriverV3Route> & {id?: string}
        const removed = payload.old as Partial<DriverV3Route> & {id?: string}
        if (payload.eventType === 'DELETE' && removed.id) {
          routesRef.current = routesRef.current.filter(route => route.id !== removed.id)
          setRoutes(routesRef.current)
        } else if (changed.id) {
          routesRef.current = routesRef.current.map(route => route.id === changed.id ? {...route, ...changed} as DriverV3Route : route)
          setRoutes(routesRef.current)
        }
        sync.schedule()
      })
      .on('postgres_changes', {event: '*', schema: 'public', table: 'routes', filter: `company_id=eq.${companyId}`}, payload => {
        const changed = payload.new as Partial<DriverV3Route> & {id?: string}
        const removed = payload.old as Partial<DriverV3Route> & {id?: string}
        if (payload.eventType === 'DELETE' && removed.id) {
          routesRef.current = routesRef.current.filter(route => route.id !== removed.id)
          setRoutes(routesRef.current)
        } else if (changed.id && routesRef.current.some(route => route.id === changed.id)) {
          routesRef.current = routesRef.current.map(route => route.id === changed.id ? {...route, ...changed} as DriverV3Route : route)
          setRoutes(routesRef.current)
        }
        // Company-scoped events also catch assignment/reassignment changes
        // where the driver's filtered subscription may not receive the row.
        void load(true)
      })
      .subscribe()
    const onFocus = () => { sync.schedule() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const tick = window.setInterval(() => { sync.schedule() }, 20000)
    return () => {
      sync.dispose()
      void client.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      window.clearInterval(tick)
    }
  }, [companyId, driverId, load])

  const snapshot = useMemo(
    () => (driverId ? buildDriverSnapshot(routes as any, driverId, operationalDate()) : null),
    [routes, driverId],
  )

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  return {routes, driverId, companyId, companyPlan, branchId, branchName, drivingSession, liveFix, setLiveFix, loading, error, offline, lastSyncedAt, refresh: () => load(), snapshot}
}

export function DriverV3Provider({children}: {children: ReactNode}) {
  const value = useDriverDataInternal()
  return createElement(DriverV3Context.Provider, {value}, children)
}

export function useDriverData() {
  const ctx = useContext(DriverV3Context)
  if (!ctx) throw new Error('DriverV3Provider required')
  return ctx
}
