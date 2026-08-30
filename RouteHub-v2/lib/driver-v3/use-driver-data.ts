'use client'
import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react'
import {currentMembership, currentUser} from '../data'
import {getSupabase} from '../supabase'
import {operationalDate} from '../driver-queue'
import {buildDriverSnapshot} from '../driver/driver-refresh'
import type {DriverV3Route} from './types'
import {getActiveDrivingSession, type DrivingSession} from '../driving-session'

type DriverV3Data = {
  routes: DriverV3Route[]
  driverId: string
  companyId: string
  branchId: string | null
  drivingSession: DrivingSession | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
  snapshot: ReturnType<typeof buildDriverSnapshot> | null
}

const DriverV3Context = createContext<DriverV3Data | null>(null)

function useDriverDataInternal(): DriverV3Data {
  const [routes, setRoutes] = useState<DriverV3Route[]>([])
  const [driverId, setDriverId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [drivingSession, setDrivingSession] = useState<DrivingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const user = await currentUser()
      const membership = await currentMembership()
      setDriverId(user.id)
      setCompanyId(membership.company_id)
      setBranchId(membership.branch_id ?? null)
      const result = await getSupabase()
        .from('routes')
        .select('id,company_id,branch_id,driver_id,route_date,status,position,mission_type,destination_name,destination_address,destination_phone,destination_lat,destination_lng,order_number,notes,driver_note,scheduled_at,arrived_at,completed_at,route_started_at,route_completed_at,completion_photo_path,customer_signature_path,finalized_at')
        .eq('company_id', membership.company_id)
        .eq('driver_id', user.id)
        .order('position', {ascending: true})
      if (result.error) throw result.error
      setRoutes((result.data || []) as DriverV3Route[])
      const session = await getActiveDrivingSession(user.id)
      if (session.error) throw session.error
      setDrivingSession(session.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Driver workspace.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const snapshot = useMemo(
    () => (driverId ? buildDriverSnapshot(routes as any, driverId, operationalDate()) : null),
    [routes, driverId],
  )

  return {routes, driverId, companyId, branchId, drivingSession, loading, error, refresh: load, snapshot}
}

export function DriverV3Provider({children}: {children: ReactNode}) {
  const value = useDriverDataInternal()
  return <DriverV3Context.Provider value={value}>{children}</DriverV3Context.Provider>
}

export function useDriverData() {
  const ctx = useContext(DriverV3Context)
  if (!ctx) throw new Error('DriverV3Provider required')
  return ctx
}
