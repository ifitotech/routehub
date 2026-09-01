'use client'
import {createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {currentMembership, currentUser} from '../data'
import {getSupabase} from '../supabase'
import {operationalDate} from '../driver-queue'
import {buildDriverSnapshot} from '../driver/driver-refresh'
import type {DriverV3Route} from './types'
import {getActiveDrivingSession, startDrivingDay, type DrivingSession} from '../driving-session'
import {createRealtimeRefresh} from '../realtime-sync'

type DriverV3Data = {
  routes: DriverV3Route[]
  driverId: string
  companyId: string
  branchId: string | null
  drivingSession: DrivingSession | null
  liveFix: {lat: number; lng: number; at: string} | null
  setLiveFix: (fix: {lat: number; lng: number; at: string} | null) => void
  loading: boolean
  error: string
  refresh: () => Promise<void>
  snapshot: ReturnType<typeof buildDriverSnapshot> | null
}

const DriverV3Context = createContext<DriverV3Data | null>(null)

function useDriverDataInternal(): DriverV3Data {
  const [routes, setRoutes] = useState<DriverV3Route[]>([])
  const routesRef = useRef<DriverV3Route[]>([])
  const [driverId, setDriverId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [drivingSession, setDrivingSession] = useState<DrivingSession | null>(null)
  const [liveFix, setLiveFix] = useState<{lat: number; lng: number; at: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (quiet=false) => {
    if(!quiet) setLoading(true)
    setError('')
    try {
      const user = await currentUser()
      const membership = await currentMembership()
      setDriverId(user.id)
      setCompanyId(membership.company_id)
      setBranchId(membership.branch_id ?? null)
      const first = await getSupabase()
        .from('routes')
        .select('id,company_id,branch_id,driver_id,route_date,status,position,mission_type,destination_name,destination_address,destination_phone,destination_contact_name,destination_lat,destination_lng,order_number,notes,driver_note,scheduled_at,arrived_at,completed_at,route_started_at,route_completed_at,completion_photo_path,customer_signature_path,finalized_at')
        .eq('company_id', membership.company_id)
        .eq('driver_id', user.id)
        .order('position', {ascending: true})
      let rows = first.data
      let loadError = first.error
      if (loadError && /route_number|destination_contact_name|schema cache|column/i.test(loadError.message || '')) {
        const second = await getSupabase()
          .from('routes')
          .select('id,company_id,branch_id,driver_id,route_date,status,position,mission_type,destination_name,destination_address,destination_phone,destination_lat,destination_lng,order_number,notes,driver_note,scheduled_at,arrived_at,completed_at,route_started_at,route_completed_at,completion_photo_path,customer_signature_path,finalized_at')
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
      // A driving-session/GPS problem must not hide an otherwise valid route.
      // The route remains usable and the session can be recovered on the next
      // focus/refresh once the protected session table is available.
      let session = await getActiveDrivingSession(user.id)
      if (!session.error && !session.data) {
        const started = await startDrivingDay({
          companyId: membership.company_id,
          branchId: membership.branch_id ?? null,
          driverId: user.id,
        })
        if (!started.error && started.data) session = started
      }
      setDrivingSession(session.data)
      if (session.data?.last_lat != null && session.data?.last_lng != null) {
        setLiveFix({
          lat: Number(session.data.last_lat),
          lng: Number(session.data.last_lng),
          at: session.data.last_updated_at || new Date().toISOString(),
        })
      }
    } catch (e) {
      // Keep the last authoritative route snapshot visible during a transient
      // session/map/network failure. Today must remain usable like the legacy
      // flow; every mutation still revalidates ownership and status server-side.
      if (!routesRef.current.length) setError(e instanceof Error ? e.message : 'Unable to load Driver workspace.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if(!driverId) return
    const client = getSupabase()
    const sync = createRealtimeRefresh(() => load(true), 150)
    const channel = client
      .channel('driver-v3-routes')
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
  }, [driverId, load])

  const snapshot = useMemo(
    () => (driverId ? buildDriverSnapshot(routes as any, driverId, operationalDate()) : null),
    [routes, driverId],
  )

  return {routes, driverId, companyId, branchId, drivingSession, liveFix, setLiveFix, loading, error, refresh: () => load(), snapshot}
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
