'use client'

import {chooseDefaultAssignee} from '../../lib/route-assignment'
import {getSupabase} from '../../lib/supabase'
import type {Contact, FormState} from './routes-model'
import {initialForm} from './routes-model'
import {useRoutesDerived} from './routes-workspace-derived'
import {useRoutesSave} from './routes-workspace-save'

export function useRoutesWorkspace() {
  const derived = useRoutesDerived()
  const {
    searchParams, form, setForm, drivers, defaultBranch, routes, setOriginMode,
    setMessage, setDetailsOpen, setJustCreated, setSelectedDestinationLocation,
    setPendingLocation, setSaveContactOpen, setNewContactName, setContactSaveMessage,
    setInsertBeforeId, setOpen, contacts, setContacts, companyId, branchId,
    selectedDestinationLocation, newContactName, savingContact, setSavingContact,
    c,
  } = derived

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

  const openBuilder = () => {
    const nextPriority: FormState['priority'] = searchParams.get('priority') === 'urgent' ? 'urgent' : 'normal'
    const next = initialForm(nextPriority)
    const driverId = chooseDefaultAssignee(drivers, defaultBranch?.primary_driver_id)?.user_id || form.driver_id || ''
    const lastForDriver = routes.filter(route => route.driver_id === driverId && route.route_date === next.date).sort((a,b) => Number(b.position || 0) - Number(a.position || 0))[0]
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
    setOpen(true)
  }

  const {save, renderRouteCards} = useRoutesSave(derived)
  return {...derived, saveDestinationAsContact, openBuilder, save, renderRouteCards, loadError: derived.message}
}
