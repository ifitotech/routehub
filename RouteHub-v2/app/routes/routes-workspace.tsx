'use client'

import {useEffect} from 'react'
import {chooseDefaultAssignee} from '../../lib/route-assignment'
import {getSupabase} from '../../lib/supabase'
import type {Contact, FormState} from './routes-model'
import {initialForm, routeDateValue} from './routes-model'
import {useRoutesDerived} from './routes-workspace-derived'
import {useRoutesSave} from './routes-workspace-save'

export function useRoutesWorkspace() {
  const derived = useRoutesDerived()
  const {
    searchParams, form, setForm, drivers, defaultBranch, routes, setOriginMode,
    message, setMessage, setDetailsOpen, setJustCreated, setSelectedDestinationLocation,
    setPendingLocation, setSaveContactOpen, setNewContactName, setContactSaveMessage,
    setInsertBeforeId, setOpen, setEditingRouteId, contacts, setContacts, companyId, branchId,
    selectedDestinationLocation, newContactName, savingContact, setSavingContact,
    c,
  } = derived

  // A success banner ("Route published successfully.", "Route cancelled.",
  // etc. - anything without the Retry button routes-screen.tsx shows for
  // real errors) used to stay in the layout until some other action
  // happened to call setMessage again, permanently eating space above the
  // list and pushing it into an unwanted scroll. Auto-clear it instead;
  // error messages (which do show Retry) are left alone so the user has
  // time to read and act on them.
  useEffect(() => {
    if (!message) return
    // Same check routes-screen.tsx uses to decide whether to render the
    // Retry button - keep both in sync, since this is what tells a real
    // error (leave it up) apart from a status message (clear it).
    const isSuccessMessage = message.includes('successfully') || message.includes('publicad')
    if (!isSuccessMessage) return
    const timeout = window.setTimeout(() => setMessage(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [message, setMessage])

  const saveDestinationAsContact = async () => {
    const address = (selectedDestinationLocation?.formattedAddress || form.destination).trim()
    const name = newContactName.trim()
    if (!address || !name || !companyId || savingContact) return
    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()
    const duplicate = contacts.find(contact => normalize(contact.company_name) === normalize(name) && normalize(contact.address) === normalize(address))
    if (duplicate) {
      setForm(current => ({...current, contact_id: duplicate.id, destination: duplicate.address, destination_label: duplicate.company_name, destination_phone: duplicate.phone || ''}))
      setSaveContactOpen(false)
      setContactSaveMessage(c.contactAlreadyExists)
      return
    }
    setSavingContact(true)
    setContactSaveMessage('')
    try {
      const client = getSupabase()
      const {data, error} = await client.from('contacts').insert({
        company_id: companyId,
        branch_id: branchId,
        company_name: name,
        contact_name: null,
        address,
        phone: form.destination_phone.trim() || null,
        latitude: selectedDestinationLocation?.coordinate.lat ?? null,
        longitude: selectedDestinationLocation?.coordinate.lng ?? null,
        location_source: selectedDestinationLocation?.source || 'routehub',
        location_external_id: selectedDestinationLocation?.externalId || null,
      }).select('id,company_name,contact_name,address,phone,location_code,latitude,longitude,location_source,location_external_id').single()
      if (error) throw error
      if (!data) throw new Error('Contact could not be saved')
      const contact = data as Contact
      setContacts(current => [...current, contact].sort((a, b) => a.company_name.localeCompare(b.company_name)))
      setForm(current => ({...current, contact_id: contact.id, destination: contact.address, destination_label: contact.company_name, destination_phone: contact.phone || ''}))
      setSaveContactOpen(false)
      setNewContactName('')
      setContactSaveMessage(c.contactSaved)
    } catch (error) {
      console.error(error)
      setContactSaveMessage(c.contactSaveError)
    } finally {
      setSavingContact(false)
    }
  }

  // Takes the calendar's currently selected date so opening the form while
  // browsing, say, next Tuesday starts a route for next Tuesday instead of
  // always defaulting to today.
  const openBuilder = (dateOverride?: string) => {
    const nextPriority: FormState['priority'] = searchParams.get('priority') === 'urgent' ? 'urgent' : 'normal'
    const next = initialForm(nextPriority)
    const todayValue = next.date
    if (dateOverride) next.date = dateOverride
    const driverId = chooseDefaultAssignee(drivers, defaultBranch?.primary_driver_id)?.user_id || form.driver_id || ''
    // "Last route" only makes sense for today - a route scheduled for any
    // other date gives the driver time to return to the branch first.
    const lastForDriver = next.date === todayValue
      ? routes.filter(route => route.driver_id === driverId && routeDateValue(route) === next.date).sort((a,b) => Number(b.position || 0) - Number(a.position || 0))[0]
      : undefined
    setOriginMode(lastForDriver ? 'previous' : 'branch')
    setForm({...next, driver_id: driverId, origin: lastForDriver?.destination_address || lastForDriver?.destination_name || defaultBranch?.address || defaultBranch?.name || ''})
    setMessage('')
    setDetailsOpen(false)
    setJustCreated(false)
    setSelectedDestinationLocation(null)
    setPendingLocation(null)
    setSaveContactOpen(false)
    setNewContactName('')
    setContactSaveMessage('')
    setInsertBeforeId('')
    setEditingRouteId('')
    setOpen(true)
  }

  const {save, renderRouteCards, cancelRoute, moveRoute, toggleRoutePause, assignRouteToDriver, unassignRoute, moveRouteToPosition, busyRouteId} = useRoutesSave(derived)
  return {...derived, saveDestinationAsContact, openBuilder, save, renderRouteCards, cancelRoute, moveRoute, toggleRoutePause, assignRouteToDriver, unassignRoute, moveRouteToPosition, busyRouteId, loadError: derived.message}
}
