'use client'

import {useMemo} from 'react'
import {sanitizeCoordinate} from '../../lib/maps/coordinates'
import type {GeocodedLocation} from '../../lib/maps/types'
import type {AddressSearchSuggestion, LocalAddressSuggestion} from '../google-address-input'
import {
  branchLocation,
  localSchedule,
  originCopy,
  routeDateValue,
  savedCoordinate,
  storedCoordinate,
  type OriginMode,
  type RouteRecord,
} from './routes-model'
import {useRoutesCore} from './routes-workspace-core'

export function useRoutesDerived() {
  const core = useRoutesCore()
  const {
    locale, c, form, setForm, contacts, branches, drivers, driverLocations, routes,
    branchId, originMode, setOriginMode, selectedDestinationLocation, setSelectedDestinationLocation,
    pendingLocation, setPendingLocation,
  } = core

  const driverIndex = useMemo(() => new Map(drivers.map(driver => [driver.user_id, driver])), [drivers])
  const selectedContact = contacts.find(contact => contact.id === form.contact_id)
  const destinationSuggestions = useMemo<LocalAddressSuggestion[]>(() => [
    ...contacts.map(contact => {
      const coordinate = savedCoordinate(contact)
      return {
        id: `contact:${contact.id}`,
        primary: contact.location_code ? `${contact.location_code} · ${contact.company_name}` : contact.company_name,
        secondary: [contact.contact_name, contact.address].filter(Boolean).join(' · '),
        value: `${contact.company_name} - ${contact.address}`,
        location: coordinate ? {
          name: contact.company_name,
          formattedAddress: contact.address,
          coordinate,
          source: contact.location_source || 'routehub',
          externalId: contact.location_external_id || undefined,
        } satisfies GeocodedLocation : undefined,
      }
    }),
    ...branches.filter(branch => Boolean(branch.address)).map(branch => ({
      id: `branch:${branch.id}`,
      primary: branch.name,
      secondary: branch.address || '',
      value: `${branch.name} - ${branch.address}`,
      location: branchLocation(branch) || undefined,
    })),
  ], [branches, contacts])
  const oc = originCopy[locale]
  const defaultBranch = branches.find(branch => branch.id === branchId) || branches[0]
  const previousRoute = useMemo(() => routes
    .filter(route => route.driver_id === form.driver_id && route.route_date === form.date)
    .sort((a, b) => Number(b.position || 0) - Number(a.position || 0))[0], [routes, form.driver_id, form.date])
  const branchForValue = (value: string) => branches.find(branch => (branch.address || branch.name) === value) || null
  const originContact = originMode === 'contact' ? contacts.find(contact => contact.address === form.origin) || null : null
  const originBranch = originMode === 'branch' ? branchForValue(form.origin) || defaultBranch : null
  const returnBranch = form.type === 'return' ? branchForValue(form.destination) || defaultBranch : null
  const selectedDriverGps = storedCoordinate(driverLocations[form.driver_id])
  const previousDestinationCoordinate = sanitizeCoordinate({lat: previousRoute?.destination_lat, lng: previousRoute?.destination_lng})
  const originBranchCoordinate = savedCoordinate(originBranch)
  const originContactCoordinate = sanitizeCoordinate({lat: originContact?.latitude, lng: originContact?.longitude})
  const returnBranchCoordinate = savedCoordinate(returnBranch)
  const searchContext = defaultBranch?.address || ''
  const todayValue = localSchedule().date
  const routeSort = (left: RouteRecord, right: RouteRecord) => Number(left.position || 0) - Number(right.position || 0) || String(left.scheduled_at || '').localeCompare(String(right.scheduled_at || '')) || left.id.localeCompare(right.id)
  const todayRoutes = useMemo(() => routes
    .filter(route => (!routeDateValue(route) || routeDateValue(route) === todayValue) && !['completed', 'issue', 'cancelled'].includes(route.status || ''))
    .sort(routeSort), [routes, todayValue])
  const inProgressRoutes = useMemo(() => todayRoutes.filter(route => ['active', 'paused'].includes(route.status || '')), [todayRoutes])
  const scheduledTodayRoutes = useMemo(() => todayRoutes.filter(route => !['active', 'paused'].includes(route.status || '')), [todayRoutes])
  const issueTodayRoutes = useMemo(() => routes
    .filter(route => (!routeDateValue(route) || routeDateValue(route) === todayValue) && route.status === 'issue')
    .sort(routeSort), [routes, todayValue])
  const upcomingRoutes = useMemo(() => routes
    .filter(route => routeDateValue(route) > todayValue && !['completed', 'issue', 'cancelled'].includes(route.status || ''))
    .sort((left, right) => routeDateValue(left).localeCompare(routeDateValue(right)) || routeSort(left, right)), [routes, todayValue])
  const completedTodayRoutes = useMemo(() => routes
    .filter(route => (!routeDateValue(route) || routeDateValue(route) === todayValue) && route.status === 'completed')
    .sort(routeSort), [routes, todayValue])
  const planningMapRoutes = useMemo(() => {
    const configured = routes
      .filter(route => {
        const date = routeDateValue(route)
        const today = !date || date === todayValue
        const branch = !branchId || !route.branch_id || route.branch_id === branchId
        const operational = ['published', 'pending', 'active', 'paused', 'issue', 'draft'].includes(route.status || '')
        return today && branch && operational
      })
      .map(route => ({id: route.id, mission_type: route.mission_type, origin_address: route.origin_address, origin_lat: route.origin_lat, origin_lng: route.origin_lng, destination_address: route.destination_address, destination_name: route.destination_name, destination_lat: route.destination_lat, destination_lng: route.destination_lng, status: route.status, driver_id: route.driver_id, position: route.position}))
    if (form.destination.trim()) {
      const origin = originMode === 'branch' ? originBranchCoordinate : originMode === 'previous' ? previousDestinationCoordinate : originMode === 'contact' ? originContactCoordinate : originMode === 'custom' ? selectedDriverGps : null
      const destination = form.type === 'return' ? returnBranchCoordinate : sanitizeCoordinate(selectedDestinationLocation?.coordinate || {lat: selectedContact?.latitude, lng: selectedContact?.longitude})
      configured.push({
        id: 'draft-preview',
        mission_type: form.type,
        origin_address: originMode === 'branch' ? originBranch?.address || form.origin : form.origin,
        origin_lat: origin?.lat ?? null,
        origin_lng: origin?.lng ?? null,
        destination_address: returnBranch?.address || form.destination,
        destination_name: returnBranch?.name || form.destination_label || selectedContact?.company_name || form.destination,
        destination_lat: destination?.lat ?? null,
        destination_lng: destination?.lng ?? null,
        status: 'pending',
        driver_id: form.driver_id || null,
        position: configured.length + 1,
      })
    }
    return configured
  }, [branchId, form.destination, form.destination_label, form.driver_id, form.origin, form.type, originBranch?.address, originBranchCoordinate, originContactCoordinate, originMode, previousDestinationCoordinate, returnBranch?.address, returnBranch?.name, returnBranchCoordinate, routes, selectedContact?.company_name, selectedContact?.latitude, selectedContact?.longitude, selectedDestinationLocation, selectedDriverGps, todayValue])

  const setOriginSource = (mode: OriginMode) => {
    setOriginMode(mode)
    if (mode === 'branch') setForm(current => ({...current, origin: defaultBranch?.address || defaultBranch?.name || ''}))
    if (mode === 'previous') setForm(current => ({...current, origin: previousRoute?.destination_address || previousRoute?.destination_name || driverLocations[current.driver_id] || ''}))
    if (mode === 'contact') setForm(current => ({...current, origin: contacts[0]?.address || ''}))
    if (mode === 'custom') setForm(current => ({...current, origin: ''}))
  }

  const updateDestination = (value: string) => {
    const normalized = value.trim().toLowerCase()
    const contact = contacts.find(item => {
      const option = `${item.company_name} - ${item.address}`.toLowerCase()
      const code = item.location_code?.toLowerCase() || ''
      return option === normalized || code === normalized || item.company_name.toLowerCase() === normalized || item.address.toLowerCase() === normalized
    })
    setForm(current => {
      const replacingSavedContact = Boolean(current.contact_id)
      return {
        ...current,
        destination: value,
        contact_id: contact?.id || '',
        destination_label: contact ? '' : replacingSavedContact ? '' : current.destination_label,
        destination_phone: contact?.phone || (replacingSavedContact ? '' : current.destination_phone),
        stop_contact_name: contact?.contact_name || (replacingSavedContact ? '' : current.stop_contact_name),
      }
    })
    if (selectedDestinationLocation && value.trim() !== selectedDestinationLocation.formattedAddress && value.trim() !== selectedDestinationLocation.name) setSelectedDestinationLocation(null)
    setPendingLocation(null)
  }

  const selectDestinationContact = (suggestion: LocalAddressSuggestion) => {
    const contactId = suggestion.id.startsWith('contact:') ? suggestion.id.slice('contact:'.length) : ''
    const branch = suggestion.id.startsWith('branch:') ? branches.find(item => item.id === suggestion.id.slice('branch:'.length)) : undefined
    const contact = contacts.find(item => item.id === contactId)
    setForm(current => ({
      ...current,
      destination: contact?.address || branch?.address || suggestion.value,
      contact_id: contact?.id || '',
      destination_label: branch?.name || '',
      destination_phone: contact?.phone || '',
      stop_contact_name: contact?.contact_name || '',
    }))
    setSelectedDestinationLocation(suggestion.location || null)
    setPendingLocation(null)
  }

  const selectExternalDestination = (suggestion: AddressSearchSuggestion) => {
    setPendingLocation({
      name: suggestion.name || suggestion.primary,
      formattedAddress: suggestion.label,
      coordinate: suggestion.coordinate || {lat: 0, lng: 0},
      source: suggestion.source,
      externalId: suggestion.externalId,
    })
  }

  const useConfirmedDestination = () => {
    if (!pendingLocation || pendingLocation.coordinate.lat === 0 || pendingLocation.coordinate.lng === 0) return
    setSelectedDestinationLocation(pendingLocation)
    setForm(current => ({
      ...current,
      destination: pendingLocation.formattedAddress,
      destination_label: pendingLocation.name || '',
      destination_phone: '',
      contact_id: '',
    }))
    setPendingLocation(null)
  }

  const priorityRoutes = routes.filter(route => route.driver_id === form.driver_id && route.route_date === form.date && ['draft', 'pending', 'published', 'paused'].includes(route.status || '')).sort(routeSort)

  return {
    ...core,
    defaultBranch, todayValue, oc, selectedContact, destinationSuggestions, searchContext,
    selectDestinationContact, selectExternalDestination, updateDestination, useConfirmedDestination,
    setOriginSource, scheduledTodayRoutes, upcomingRoutes, completedTodayRoutes,
    issueTodayRoutes, planningMapRoutes, todayRoutes, inProgressRoutes, priorityRoutes,
    selectedDriverGps, originBranchCoordinate, previousDestinationCoordinate,
    originContactCoordinate, returnBranchCoordinate, returnBranch, originBranch,
    previousRoute, driverIndex, routeSort,
  }
}
