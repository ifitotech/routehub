'use client'

import {useSearchParams} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'
import {chooseDefaultAssignee} from '../../lib/route-assignment'
import type {GeocodedLocation} from '../../lib/maps/types'
import {
  initialForm,
  routeCopy,
  routeListStatuses,
  type Branch,
  type Contact,
  type Driver,
  type FormState,
  type OriginMode,
  type RouteRecord,
} from './routes-model'

export function useRoutesCore() {
  const {locale,t}=useLocale()
  const c=routeCopy[locale]
  const searchParams = useSearchParams()
  const requestedPriority = searchParams.get('priority') === 'urgent' ? 'urgent' : 'normal'
  const [form, setForm] = useState<FormState>(() => initialForm(requestedPriority))
  const [contacts, setContacts] = useState<Contact[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [driverLocations, setDriverLocations] = useState<Record<string,string>>({})
  const [routes, setRoutes] = useState<RouteRecord[]>([])
  const [companyId, setCompanyId] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [justCreated, setJustCreated] = useState(false)
  const [originMode, setOriginMode] = useState<OriginMode>('branch')
  const [insertBeforeId, setInsertBeforeId] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedDestinationLocation, setSelectedDestinationLocation] = useState<GeocodedLocation | null>(null)
  const [pendingLocation, setPendingLocation] = useState<GeocodedLocation | null>(null)
  const [saveContactOpen, setSaveContactOpen] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [contactSaveMessage, setContactSaveMessage] = useState('')

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    try {
      const client = getSupabase()
      const {data: userData, error: userError} = await client.auth.getUser()
      if (userError) throw userError
      if (!userData.user) throw Error('Sign in to view routes.')
      setCurrentUserId(userData.user.id)

      const {data: membership, error: membershipError} = await client
        .from('company_users')
        .select('company_id,branch_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle()
      if (membershipError) throw membershipError
      if (!membership) throw Error('No company membership was found.')

      setCompanyId(membership.company_id)
      setBranchId(membership.branch_id || null)

      let assigneeQuery = client.from('company_users').select('user_id,role,branch_id,users(email,name)').eq('company_id', membership.company_id).in('role', ['driver', 'branch_manager', 'operations_manager', 'sales_representative', 'counter_sales'])
      if (membership.branch_id) assigneeQuery = assigneeQuery.or(`branch_id.is.null,branch_id.eq.${membership.branch_id}`)
      const [contactResult, driverResult, routeResult, branchResult, locationResult] = await Promise.all([
        client.from('contacts').select('id,company_name,contact_name,address,phone,location_code,latitude,longitude,location_source,location_external_id').eq('company_id', membership.company_id).order('company_name'),
        assigneeQuery,
        client.from('routes').select('id,company_id,branch_id,driver_id,mission_type,priority,status,origin_name,origin_address,origin_lat,origin_lng,destination_name,destination_address,destination_lat,destination_lng,destination_location_source,destination_location_external_id,destination_phone,scheduled_at,route_date,position,notes,order_number').eq('company_id', membership.company_id).in('status', routeListStatuses).order('scheduled_at', {ascending:true, nullsFirst:false}).order('position', {ascending:true}),
        client.from('branches').select('id,name,address,primary_driver_id,latitude,longitude,location_source,location_external_id').eq('company_id', membership.company_id).order('name'),
        client.from('driving_sessions').select('driver_id,last_lat,last_lng,last_updated_at,status').eq('company_id', membership.company_id).in('status',['active','paused']).order('last_updated_at',{ascending:false}),
      ])
      if (contactResult.error) throw contactResult.error
      if (driverResult.error) throw driverResult.error
      if (routeResult.error) throw routeResult.error
      if (branchResult.error) throw branchResult.error
      if (locationResult.error) throw locationResult.error
      const driverIds = ((driverResult.data || []) as Driver[]).map(driver => driver.user_id).filter(Boolean)
      const profileResult = driverIds.length ? await client.from('users').select('id,name,email').in('id', driverIds) : {data: [], error: null}
      if (profileResult.error) throw profileResult.error

      const availableBranches = (branchResult.data || []) as Branch[]
      const defaultBranch = availableBranches.find(branch => branch.id === membership.branch_id) || availableBranches[0]
      const profileById = new Map((profileResult.data || []).map((profile: {id: string; name?: string | null; email?: string | null}) => [profile.id, profile]))
      const availableDrivers = ((driverResult.data || []) as Driver[]).map(driver => ({...driver, users: profileById.get(driver.user_id) || driver.users})) as Driver[]
      availableDrivers.sort((a,b) => Number(b.user_id === defaultBranch?.primary_driver_id) - Number(a.user_id === defaultBranch?.primary_driver_id) || Number(b.role === 'driver') - Number(a.role === 'driver'))
      const preferredDriver = chooseDefaultAssignee(availableDrivers, defaultBranch?.primary_driver_id)
      setContacts((contactResult.data || []) as Contact[])
      setDrivers(availableDrivers)
      setRoutes((routeResult.data || []) as RouteRecord[])
      setBranches(availableBranches)
      const latestLocations: Record<string,string> = {}
      for (const row of (locationResult.data || []) as Array<{driver_id:string;last_lat:number|null;last_lng:number|null}>) if (latestLocations[row.driver_id]===undefined && row.last_lat!=null && row.last_lng!=null) latestLocations[row.driver_id] = `${row.last_lat}, ${row.last_lng}`
      setDriverLocations(latestLocations)
      setForm(current => ({
        ...current,
        driver_id: availableDrivers.some(driver => driver.user_id === current.driver_id) ? current.driver_id : preferredDriver?.user_id || '',
        origin: current.origin || defaultBranch?.address || defaultBranch?.name || '',
      }))
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.loadError)
    } finally {
      setLoading(false)
    }
  }, [c.loadError])

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])

  useEffect(() => {
    const requestedContact = searchParams.get('contact')
    const requestedDestination = searchParams.get('destination')
    const requestedType = searchParams.get('type')
    const requestedPriority = searchParams.get('priority')
    if (searchParams.get('new') === '1' || requestedContact || requestedDestination || requestedPriority === 'urgent') {
      const contact = contacts.find(item => item.id === requestedContact)
      setForm(current => ({
        ...current,
        type: ['pickup','delivery','transfer','return'].includes(requestedType || '') ? requestedType as FormState['type'] : current.type,
        priority: requestedPriority === 'urgent' || requestedPriority === 'priority' ? requestedPriority : current.priority,
        contact_id: contact?.id || '',
        destination: contact?.address || requestedDestination || current.destination,
        destination_label: contact?.company_name || current.destination_label,
        destination_phone: contact?.phone || current.destination_phone,
        stop_contact_name: contact?.contact_name || current.stop_contact_name,
      }))
      setOpen(true)
    }
  }, [contacts, searchParams])

  useEffect(() => {
    if (!open) return
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, saving])

  return {
    locale, t, c, searchParams, form, setForm, contacts, setContacts, branches, setBranches,
    drivers, setDrivers, driverLocations, routes, setRoutes, companyId, currentUserId,
    branchId, message, setMessage, loading, setLoading, saving, setSaving, open, setOpen,
    detailsOpen, setDetailsOpen, justCreated, setJustCreated, originMode, setOriginMode,
    insertBeforeId, setInsertBeforeId, previewOpen, setPreviewOpen,
    selectedDestinationLocation, setSelectedDestinationLocation, pendingLocation, setPendingLocation,
    saveContactOpen, setSaveContactOpen, newContactName, setNewContactName,
    savingContact, setSavingContact, contactSaveMessage, setContactSaveMessage,
    loadWorkspace,
  }
}
