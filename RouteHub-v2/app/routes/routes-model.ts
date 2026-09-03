import {sanitizeCoordinate} from '../../lib/maps/coordinates'
import type {GeocodedLocation} from '../../lib/maps/types'
import {originCopy, routeCopy, routeTypes, routeStatuses, routeListStatuses} from './routes-copy'

export type RouteCopy = typeof routeCopy.en
export {originCopy, routeCopy, routeTypes, routeStatuses, routeListStatuses}

export type Contact = {
  id: string
  company_name: string
  contact_name?: string | null
  location_code?: string | null
  address: string
  phone?: string | null
  latitude?: number | null
  longitude?: number | null
  location_source?: GeocodedLocation['source'] | null
  location_external_id?: string | null
}

export type DriverProfile = {email?: string | null; name?: string | null}
export type Branch = {
  id: string
  name: string
  address?: string | null
  primary_driver_id?: string | null
  latitude?: number | null
  longitude?: number | null
  location_source?: GeocodedLocation['source'] | null
  location_external_id?: string | null
}

export function storedCoordinate(value:string|undefined){
  if(!value)return null
  const [lat,lng]=value.split(',').map(Number)
  return sanitizeCoordinate({lat,lng})
}

export function savedCoordinate(location:{latitude?:number|null;longitude?:number|null}|null|undefined){
  return sanitizeCoordinate({lat:location?.latitude,lng:location?.longitude})
}

export function branchLocation(branch:Branch|null|undefined):GeocodedLocation|null{
  const coordinate=savedCoordinate(branch)
  if(!branch||!coordinate)return null
  return {
    name:branch.name,
    formattedAddress:branch.address||branch.name,
    coordinate,
    source:branch.location_source||'routehub',
    externalId:branch.location_external_id||undefined,
  }
}

export type OriginMode = 'branch' | 'previous' | 'contact' | 'custom'
export type Driver = {
  user_id: string
  role?: string
  users?: DriverProfile | DriverProfile[] | null
}

export type RouteRecord = {
  id: string
  company_id?: string | null
  branch_id?: string | null
  driver_id: string | null
  mission_type: string | null
  priority: string | null
  status: string | null
  origin_name: string | null
  origin_address: string | null
  destination_name: string | null
  destination_address: string | null
  destination_lat: number | null
  destination_lng: number | null
  destination_location_source: GeocodedLocation['source'] | null
  destination_location_external_id: string | null
  origin_lat: number | null
  origin_lng: number | null
  scheduled_at: string | null
  route_date: string | null
  position: number | null
  notes: string | null
  order_number: string | null
}

export type FormState = {
  type: 'pickup' | 'delivery' | 'transfer' | 'return'
  origin: string
  destination: string
  destination_label: string
  destination_phone: string
  stop_contact_name: string
  contact_id: string
  priority: 'normal' | 'priority' | 'urgent'
  order_number: string
  notes: string
  date: string
  time: string
  driver_id: string
  insert_before_id: string
}

export function localSchedule() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString()
  return {date: local.slice(0, 10), time: local.slice(11, 16)}
}

export function initialForm(priority: FormState['priority'] = 'normal'): FormState {
  return {
    type: 'delivery',
    origin: '',
    destination: '',
    destination_label: '',
    destination_phone: '',
    stop_contact_name: '',
    contact_id: '',
    priority,
    order_number: '',
    notes: '',
    ...localSchedule(),
    driver_id: '',
    insert_before_id: '',
  }
}

export function profileFor(driver: Driver) {
  return Array.isArray(driver.users) ? driver.users[0] : driver.users
}

export function friendlyName(email?: string | null) {
  if (!email) return 'Team driver'
  const local = email.split('@')[0] || ''
  const words = local.replace(/[._-]+/g, ' ').split(' ').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1))
  return words.join(' ') || 'Team driver'
}

export function driverDetails(driver?: Driver, fallback='Team driver') {
  const profile = profileFor(driver || {user_id: ''})
  const email = profile?.email || ''
  return {name: profile?.name || (email ? friendlyName(email) : fallback), email}
}

export function typeLabel(type: string | null | undefined, c: RouteCopy) {
  return type === 'pickup' ? c.pickup : type === 'delivery' ? c.delivery : type === 'return' ? c.return : type === 'transfer' ? c.transfer : c.route
}

export function statusLabel(status: string | null | undefined, c: RouteCopy) {
  if (status === 'active') return c.inProgress
  if (status === 'published') return c.statusPublished
  if (status === 'paused') return c.paused
  if (status === 'completed') return c.completedStatus
  if (status === 'issue') return c.issue
  if (status === 'draft') return c.draft
  return c.pending
}

export function routeTime(route: RouteRecord, locale:string, c:RouteCopy) {
  if (!route.scheduled_at) return c.noTime
  const date = new Date(route.scheduled_at)
  if (Number.isNaN(date.getTime())) return c.noTime
  return new Intl.DateTimeFormat(locale, {hour: 'numeric', minute: '2-digit'}).format(date)
}

export function routeDateValue(route: RouteRecord) {
  return route.route_date || route.scheduled_at?.slice(0, 10) || ''
}

export function routeDate(route: RouteRecord, locale:string, c:RouteCopy) {
  const value = routeDateValue(route)
  if (!value) return c.today
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return c.today
  const todayValue = localSchedule().date
  if (value === todayValue) return c.today
  const tomorrow = new Date(`${todayValue}T12:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowValue = tomorrow.toISOString().slice(0, 10)
  const formatted = new Intl.DateTimeFormat(locale, {month: 'short', day: 'numeric'}).format(date)
  return value === tomorrowValue ? `${c.tomorrow}, ${formatted}` : formatted
}
