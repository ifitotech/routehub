'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Clock3,
  MapPin,
  PackageCheck,
  Plus,
  Route as RouteIcon,
  Search,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import styles from './routes.module.css'

type Contact = {
  id: string
  company_name: string
  contact_name?: string | null
  address: string
  phone?: string | null
}

type DriverProfile = {email?: string | null}
type Driver = {
  user_id: string
  role?: string
  users?: DriverProfile | DriverProfile[] | null
}

type RouteRecord = {
  id: string
  driver_id: string | null
  mission_type: string | null
  priority: string | null
  status: string | null
  origin_name: string | null
  origin_address: string | null
  destination_name: string | null
  destination_address: string | null
  scheduled_at: string | null
  route_date: string | null
  position: number | null
  notes: string | null
  order_number: string | null
}

type FormState = {
  type: 'pickup' | 'delivery' | 'transfer' | 'return'
  origin: string
  destination: string
  contact_id: string
  priority: 'normal' | 'priority' | 'urgent'
  order_number: string
  notes: string
  date: string
  time: string
  driver_id: string
}

const routeStatuses = ['draft', 'pending', 'published', 'active', 'paused', 'issue']
const routeTypes: Array<{value: FormState['type']; label: string}> = [
  {value: 'pickup', label: 'Pickup'},
  {value: 'delivery', label: 'Delivery'},
  {value: 'transfer', label: 'Transfer'},
  {value: 'return', label: 'Return'},
]
const priorities: Array<{value: FormState['priority']; label: string}> = [
  {value: 'normal', label: 'Normal'},
  {value: 'priority', label: 'Priority'},
  {value: 'urgent', label: 'Urgent'},
]

function localSchedule() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString()
  return {date: local.slice(0, 10), time: local.slice(11, 16)}
}

function initialForm(priority: FormState['priority'] = 'normal'): FormState {
  return {
    type: 'delivery',
    origin: 'Branch',
    destination: '',
    contact_id: '',
    priority,
    order_number: '',
    notes: '',
    ...localSchedule(),
    driver_id: '',
  }
}

function profileFor(driver: Driver) {
  return Array.isArray(driver.users) ? driver.users[0] : driver.users
}

function friendlyName(email?: string | null) {
  if (!email) return 'Team driver'
  const local = email.split('@')[0] || ''
  const words = local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  return words.join(' ') || 'Team driver'
}

function driverDetails(driver?: Driver) {
  const email = profileFor(driver || {user_id: ''})?.email || ''
  return {name: friendlyName(email), email}
}

function typeLabel(type?: string | null) {
  return routeTypes.find(item => item.value === type)?.label || 'Route'
}

function statusLabel(status?: string | null) {
  if (status === 'active') return 'In progress'
  if (status === 'published') return 'Published'
  if (status === 'paused') return 'Paused'
  if (status === 'issue') return 'Issue'
  if (status === 'draft') return 'Draft'
  return 'Pending'
}

function routeTime(route: RouteRecord) {
  if (!route.scheduled_at) return 'No time set'
  const date = new Date(route.scheduled_at)
  if (Number.isNaN(date.getTime())) return 'No time set'
  return new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit'}).format(date)
}

function routeDate(route: RouteRecord) {
  const value = route.scheduled_at || route.route_date
  if (!value) return 'Today'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return 'Today'
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Today'
  return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric'}).format(date)
}

function MapPreview({address}: {address?: string}) {
  const query = address?.trim() ? encodeURIComponent(address.trim()) : ''
  return <div className={styles.mapShell}>
    {query ? <iframe title="Destination map preview" src={`https://www.google.com/maps?q=${query}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/> : <div className={styles.mapPlaceholder}>
      <div className={styles.mapGrid}/>
      <div className={styles.routeLine}><span/><i/><b/></div>
      <div className={styles.mapCopy}><MapPin size={20}/><div><strong>Route preview</strong><span>Choose a contact or enter an address.</span></div></div>
    </div>}
    {query && <a className={styles.mapLink} href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noreferrer"><MapPin size={15}/>Open in Google Maps</a>}
  </div>
}

export default function Routes() {
  const searchParams = useSearchParams()
  const requestedPriority = searchParams.get('priority') === 'urgent' ? 'urgent' : 'normal'
  const [form, setForm] = useState<FormState>(() => initialForm(requestedPriority))
  const [contacts, setContacts] = useState<Contact[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [routes, setRoutes] = useState<RouteRecord[]>([])
  const [companyId, setCompanyId] = useState('')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    try {
      const client = getSupabase()
      const {data: userData, error: userError} = await client.auth.getUser()
      if (userError) throw userError
      if (!userData.user) throw Error('Sign in to view routes.')

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

      const [contactResult, driverResult, routeResult] = await Promise.all([
        client.from('contacts').select('id,company_name,contact_name,address,phone').eq('company_id', membership.company_id).order('company_name'),
        client.from('company_users').select('user_id,role,users(email)').eq('company_id', membership.company_id).in('role', ['driver', 'branch_manager', 'operations_manager', 'sales_representative']),
        client.from('routes').select('id,driver_id,mission_type,priority,status,origin_name,origin_address,destination_name,destination_address,scheduled_at,route_date,position,notes,order_number').eq('company_id', membership.company_id).in('status', routeStatuses).order('scheduled_at', {ascending:true, nullsFirst:false}).order('position', {ascending:true}),
      ])
      if (contactResult.error) throw contactResult.error
      if (driverResult.error) throw driverResult.error
      if (routeResult.error) throw routeResult.error

      const availableDrivers = (driverResult.data || []) as Driver[]
      setContacts((contactResult.data || []) as Contact[])
      setDrivers(availableDrivers)
      setRoutes((routeResult.data || []) as RouteRecord[])
      setForm(current => current.driver_id || !availableDrivers[0] ? current : {...current, driver_id: availableDrivers[0].user_id})
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load route information.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])

  useEffect(() => {
    if (searchParams.get('priority') === 'urgent') {
      setForm(current => ({...current, priority: 'urgent'}))
      setOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, saving])

  const driverIndex = useMemo(() => new Map(drivers.map(driver => [driver.user_id, driver])), [drivers])
  const selectedContact = contacts.find(contact => contact.id === form.contact_id)
  const previewAddress = selectedContact?.address || form.destination

  const updateDestination = (value: string) => {
    const normalized = value.trim().toLowerCase()
    const contact = contacts.find(item => {
      const option = `${item.company_name} - ${item.address}`.toLowerCase()
      return option === normalized || item.company_name.toLowerCase() === normalized || item.address.toLowerCase() === normalized
    })
    setForm(current => ({...current, destination: value, contact_id: contact?.id || ''}))
  }

  const openBuilder = () => {
    const nextPriority: FormState['priority'] = searchParams.get('priority') === 'urgent' ? 'urgent' : 'normal'
    setForm(current => ({...initialForm(nextPriority), driver_id: current.driver_id || drivers[0]?.user_id || ''}))
    setMessage('')
    setOpen(true)
  }

  const save = async () => {
    if (saving) return
    if (!form.destination.trim() || !form.driver_id) {
      setMessage('Choose a driver and enter a destination.')
      return
    }
    if (!companyId) {
      setMessage('The company workspace is not ready. Refresh and try again.')
      return
    }

    setSaving(true)
    setMessage('Publishing route...')
    try {
      const client = getSupabase()
      const scheduledLocal = new Date(`${form.date}T${form.time || '00:00'}`)
      if (Number.isNaN(scheduledLocal.getTime())) throw Error('Choose a valid date and time.')
      const scheduledAt = scheduledLocal.toISOString()
      const selected = contacts.find(contact => contact.id === form.contact_id)
      const destinationAddress = selected?.address || form.destination.trim()
      const destinationName = selected?.company_name || form.destination.trim()

      const {data: lastRoute, error: positionError} = await client
        .from('routes')
        .select('position')
        .eq('company_id', companyId)
        .eq('driver_id', form.driver_id)
        .in('status', routeStatuses)
        .order('position', {ascending:false})
        .limit(1)
        .maybeSingle()
      if (positionError) throw positionError

      const {error} = await client.from('routes').insert({
        company_id: companyId,
        branch_id: branchId,
        driver_id: form.driver_id,
        route_date: form.date,
        mode: 'flexible',
        status: 'published',
        mission_type: form.type,
        origin_name: form.origin.trim() || 'Branch',
        origin_address: form.origin.trim() || 'Branch',
        destination_name: destinationName,
        destination_address: destinationAddress,
        priority: form.priority,
        order_number: form.order_number.trim() || null,
        notes: form.notes.trim() || null,
        scheduled_at: scheduledAt,
        position: Number(lastRoute?.position || 0) + 1,
      })
      if (error) throw error

      setOpen(false)
      setForm(current => ({...initialForm(), driver_id: current.driver_id}))
      await loadWorkspace()
      setMessage('Route published successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save route.')
    } finally {
      setSaving(false)
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>ROUTE OPERATIONS</p>
        <h1>Routes</h1>
        <p>See every active assignment and publish the next route.</p>
      </div>
      <div className={styles.headerActions}>
        <Link className={styles.secondaryButton} href="/routes/manage"><RouteIcon size={18}/>Manage routes</Link>
        <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>Add route</button>
      </div>
    </header>

    {message && <div className={message.includes('successfully') ? styles.successMessage : styles.message} role="status">{message}</div>}

    <section className={styles.listHeading}>
      <div><h2>Assigned routes</h2><p>Published, active and paused routes appear here.</p></div>
      {!loading && <span>{routes.length} active</span>}
    </section>

    {loading ? <section className={styles.routeGrid} aria-label="Loading routes">
      {[0, 1, 2].map(item => <div className={styles.skeletonCard} key={item}><i/><b/><span/></div>)}
    </section> : routes.length ? <section className={styles.routeGrid}>
      {routes.map((route, index) => {
        const details = driverDetails(route.driver_id ? driverIndex.get(route.driver_id) : undefined)
        const origin = route.origin_name || route.origin_address || 'Branch'
        const destination = route.destination_name || route.destination_address || 'Destination pending'
        const priority = route.priority || 'normal'
        const status = route.status || 'pending'
        return <article className={`${styles.routeCard} ${priority === 'urgent' ? styles.urgentCard : ''}`} key={route.id}>
          <div className={styles.cardTop}>
            <div className={styles.routeIdentity}><span className={styles.routeNumber}>{String(route.position || index + 1).padStart(2, '0')}</span><div><small>{typeLabel(route.mission_type)}</small><strong>{destination}</strong></div></div>
            <div className={`${styles.statusBadge} ${styles[`status_${status}`] || ''}`}><CircleDot size={12}/>{statusLabel(status)}</div>
          </div>
          <div className={styles.routePath}><MapPin size={17}/><span>{origin}</span><ArrowRight size={16}/><strong>{destination}</strong></div>
          <div className={styles.routeDetails}>
            <div><UserRound size={16}/><span><strong>{details.name}</strong>{details.email && <small>{details.email}</small>}</span></div>
            <div><CalendarDays size={16}/><span><strong>{routeDate(route)}</strong><small>{routeTime(route)}</small></span></div>
            <div><PackageCheck size={16}/><span><strong>{route.order_number || 'No PO'}</strong><small>Order reference</small></span></div>
          </div>
          <div className={styles.cardFooter}>
            <span className={`${styles.priorityBadge} ${styles[`priority_${priority}`] || ''}`}>{priority === 'priority' ? 'Priority' : priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
            <Link href="/routes/manage">View and manage<ChevronRight size={16}/></Link>
          </div>
        </article>
      })}
    </section> : <section className={styles.emptyState}>
      <div><Truck size={28}/></div><h2>No active routes</h2><p>Publish the first route for your team today.</p><button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>Add route</button>
    </section>}

    {open && <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setOpen(false) }}>
      <section className={styles.builder} role="dialog" aria-modal="true" aria-labelledby="new-route-title">
        <div className={styles.builderHeader}>
          <div><p className={styles.eyebrow}>NEW ASSIGNMENT</p><h2 id="new-route-title">Create route</h2></div>
          <button className={styles.closeButton} type="button" aria-label="Close route form" disabled={saving} onClick={() => setOpen(false)}><X size={22}/></button>
        </div>

        <div className={styles.builderBody}>
          <div className={styles.mapColumn}>
            <MapPreview address={previewAddress}/>
            <div className={styles.previewSummary}><span><i>1</i>{form.origin.trim() || 'Branch'}</span><span><i>2</i>{selectedContact?.company_name || form.destination.trim() || 'Choose destination'}</span></div>
          </div>

          <div className={styles.formColumn}>
            <fieldset className={styles.fieldset}>
              <legend>Route type</legend>
              <div className={styles.segmented}>{routeTypes.map(type => <button className={form.type === type.value ? styles.segmentActive : ''} type="button" key={type.value} aria-pressed={form.type === type.value} onClick={() => setForm(current => ({...current, type: type.value}))}>{type.label}</button>)}</div>
            </fieldset>

            <label className={styles.field}><span>Driver</span><div className={styles.inputWrap}><UserRound size={18}/><select value={form.driver_id} onChange={event => setForm(current => ({...current, driver_id: event.target.value}))}><option value="">Choose driver</option>{drivers.map(driver => { const details = driverDetails(driver); return <option key={driver.user_id} value={driver.user_id}>{details.email ? `${details.name} - ${details.email}` : details.name}</option> })}</select></div></label>

            <label className={styles.field}><span>Starting point</span><div className={styles.inputWrap}><MapPin size={18}/><input value={form.origin} placeholder="Branch or starting address" onChange={event => setForm(current => ({...current, origin: event.target.value}))}/></div></label>

            <label className={styles.field}><span>Contact or destination</span><div className={styles.inputWrap}><Search size={18}/><input list="routehub-contacts" value={form.destination} placeholder="Search a contact or type an address" autoComplete="off" onChange={event => updateDestination(event.target.value)}/><datalist id="routehub-contacts">{contacts.map(contact => <option key={contact.id} value={`${contact.company_name} - ${contact.address}`}>{contact.contact_name || contact.company_name}</option>)}</datalist></div><small>Search by company or address, or enter a new address manually.</small></label>

            <fieldset className={styles.fieldset}>
              <legend>Priority</legend>
              <div className={`${styles.segmented} ${styles.prioritySegments}`}>{priorities.map(priority => <button className={form.priority === priority.value ? styles.segmentActive : ''} data-priority={priority.value} type="button" key={priority.value} aria-pressed={form.priority === priority.value} onClick={() => setForm(current => ({...current, priority: priority.value}))}>{priority.label}</button>)}</div>
            </fieldset>

            <div className={styles.splitFields}>
              <label className={styles.field}><span>Date</span><div className={styles.inputWrap}><CalendarDays size={18}/><input type="date" value={form.date} onChange={event => setForm(current => ({...current, date: event.target.value}))}/></div></label>
              <label className={styles.field}><span>Time</span><div className={styles.inputWrap}><Clock3 size={18}/><input type="time" value={form.time} onChange={event => setForm(current => ({...current, time: event.target.value}))}/></div></label>
            </div>

            <label className={styles.field}><span>PO or order number <em>Optional</em></span><input value={form.order_number} placeholder="Example: PO-45872" onChange={event => setForm(current => ({...current, order_number: event.target.value}))}/></label>
            <label className={styles.field}><span>Notes <em>Optional</em></span><textarea rows={3} value={form.notes} placeholder="Delivery instructions for the driver" onChange={event => setForm(current => ({...current, notes: event.target.value}))}/></label>

            <button className={styles.publishButton} type="button" disabled={saving || !form.driver_id || !form.destination.trim()} onClick={save}>{saving ? <><span className={styles.spinner}/>Publishing...</> : <><Truck size={19}/>Publish route</>}</button>
          </div>
        </div>
      </section>
    </div>}
  </main>
}
