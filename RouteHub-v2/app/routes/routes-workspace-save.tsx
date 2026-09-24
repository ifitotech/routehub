'use client'

import {useRef, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {sanitizeCoordinate} from '../../lib/maps/coordinates'
import {geocodeAddress} from '../../lib/maps/geocoding'
import {recordActivity} from '../../lib/activity'
import {sendRoutePush} from '../../lib/route-push'
import type {RouteRecord} from './routes-model'
import {initialForm, routeStatuses, savedCoordinate} from './routes-model'

export function useRoutesSave(w: any) {
  const [busyRouteId, setBusyRouteId] = useState('')
  const routeMoveLocks = useRef(new Set<string>())
  const {
    saving, form, contacts, companyId, c, setMessage, setSaving, originMode,
    originBranchCoordinate, previousDestinationCoordinate, originContactCoordinate,
    selectedDriverGps, returnBranchCoordinate, selectedDestinationLocation, returnBranch,
    originBranch, defaultBranch, branchId, previousRoute, insertBeforeId, currentUserId,
    searchParams, setForm, setSelectedDestinationLocation, setInsertBeforeId, loadWorkspace,
    setJustCreated, locale, driverIndex, editingRouteId, setEditingRouteId, setOpen,
  } = w
  const save = async () => {
    if (saving) return
    // "Return to branch" never fills form.destination - the field just
    // displays the branch address as read-only text (new-route-details.tsx)
    // instead of writing it into the form, since the branch is implied by
    // the route type, not typed by the manager. Requiring form.destination
    // here blocked every return-to-branch route with "enter a destination"
    // even though a real destination (the branch) was already set.
    const hasDestination = form.type === 'return'
      ? Boolean(returnBranch?.address || returnBranch?.name || defaultBranch?.address || defaultBranch?.name)
      : Boolean(form.destination.trim())
    if (!hasDestination || !form.driver_id) {
      setMessage(c.chooseRequired)
      return
    }
    if (!companyId) {
      setMessage(c.workspacePending)
      return
    }
    setSaving(true)
    setMessage(c.publishing)
    try {
      const client = getSupabase()
      const scheduledLocal = new Date(`${form.date}T${form.time || '00:00'}`)
      if (Number.isNaN(scheduledLocal.getTime())) throw Error(c.invalidDate)
      const scheduledAt = scheduledLocal.toISOString()
      const branchDefaultOrigin = defaultBranch?.address || defaultBranch?.name || ''
      const shouldUsePrevious = Boolean(previousRoute && originMode === 'branch' && (!form.origin.trim() || form.origin.trim() === branchDefaultOrigin.trim()))
      const effectiveOriginMode = shouldUsePrevious ? 'previous' : originMode
      const selected = contacts.find((contact: {id: string}) => contact.id === form.contact_id)
      const destinationAddress = selected?.address || form.destination.trim()
      const destinationName = selected?.company_name || form.destination_label.trim() || form.destination.trim()
      const destinationPhone = form.destination_phone.trim() || selected?.phone || null
      const destinationContactName = form.stop_contact_name.trim() || selected?.contact_name || null
      let originCoordinate = effectiveOriginMode === 'branch' ? originBranchCoordinate : effectiveOriginMode === 'previous' ? previousDestinationCoordinate : effectiveOriginMode === 'contact' ? originContactCoordinate : effectiveOriginMode === 'custom' ? selectedDriverGps : null
      let destinationCoordinate = form.type === 'return' ? returnBranchCoordinate : sanitizeCoordinate(selectedDestinationLocation?.coordinate) || savedCoordinate(selected)
      const persistedDestinationAddress = form.type === 'return' ? returnBranch?.address || returnBranch?.name || destinationAddress : destinationAddress
      const persistedDestinationName = form.type === 'return' ? returnBranch?.name || destinationName : destinationName
      const persistedOriginAddress = effectiveOriginMode === 'previous'
        ? previousRoute?.destination_address || previousRoute?.destination_name || form.origin.trim() || branchDefaultOrigin || c.branch
        : effectiveOriginMode === 'branch'
          ? originBranch?.address || form.origin.trim() || branchDefaultOrigin || c.branch
          : form.origin.trim() || branchDefaultOrigin || c.branch
      if (!originCoordinate && persistedOriginAddress) {
        originCoordinate = (await geocodeAddress(persistedOriginAddress, undefined, defaultBranch ? savedCoordinate(defaultBranch) : null))?.coordinate || null
      }
      if (!destinationCoordinate && persistedDestinationAddress) {
        destinationCoordinate = (await geocodeAddress(persistedDestinationAddress, undefined, originCoordinate || savedCoordinate(defaultBranch)))?.coordinate || null
      }
      const payload: Record<string, unknown> = {
        company_id: companyId,
        branch_id: branchId,
        driver_id: form.driver_id,
        route_date: form.date,
        mode: 'flexible',
        status: 'published',
        mission_type: form.type,
        origin_name: effectiveOriginMode === 'branch' ? originBranch?.name || c.branch : effectiveOriginMode === 'previous' ? previousRoute?.destination_name || form.origin.trim() : contacts.find((contact: {address: string}) => contact.address === form.origin)?.company_name || form.origin.trim(),
        origin_address: persistedOriginAddress,
        origin_lat: originCoordinate?.lat ?? null,
        origin_lng: originCoordinate?.lng ?? null,
        destination_name: persistedDestinationName,
        destination_address: persistedDestinationAddress,
        destination_lat: destinationCoordinate?.lat ?? null,
        destination_lng: destinationCoordinate?.lng ?? null,
        destination_location_source: form.type === 'return' ? returnBranch?.location_source || 'routehub' : selectedDestinationLocation?.source || selected?.location_source || null,
        destination_location_external_id: form.type === 'return' ? returnBranch?.location_external_id || null : selectedDestinationLocation?.externalId || selected?.location_external_id || null,
        destination_phone: destinationPhone,
        priority: form.priority,
        order_number: form.order_number.trim() || null,
        notes: form.notes.trim() || null,
        scheduled_at: scheduledAt,
      }
      if (destinationContactName) payload.destination_contact_name = destinationContactName

      if (editingRouteId) {
        // Editing an existing route (opened via "click to edit" in Edit
        // mode) - update it in place instead of inserting a duplicate, and
        // leave its queue position untouched since it isn't moving.
        // status above always resets to 'published', but that alone doesn't
        // stop driverOperationPhase() (lib/driver/driver-state.ts) from
        // still reading route_started_at/arrived_at from BEFORE this edit -
        // a route that had been started or arrived (then edited to fix an
        // address/time/driver) kept showing the driver "Ruta activa" or
        // even "Llegué" for a stop they never actually started this time.
        payload.route_started_at = null
        payload.arrived_at = null
        let updated = await client.from('routes').update(payload).eq('id', editingRouteId).select('id').single()
        if (updated.error && /destination_contact_name|schema cache|column/i.test(updated.error.message || '')) {
          delete payload.destination_contact_name
          updated = await client.from('routes').update(payload).eq('id', editingRouteId).select('id').single()
        }
        const {data: updatedRoute, error} = updated
        if (error) throw error
        if (updatedRoute?.id && currentUserId) {
          await recordActivity({companyId,userId:currentUserId,action:'route_updated',recordId:updatedRoute.id,after:{driver_id:form.driver_id,priority:form.priority,destination:destinationAddress}}).catch(()=>undefined)
          void sendRoutePush(updatedRoute.id, 'updated')
        }
        window.dispatchEvent(new Event('routehub:notifications-refresh'))
        setForm((current: {driver_id: string}) => ({...initialForm(), driver_id: current.driver_id}))
        setSelectedDestinationLocation(null)
        setInsertBeforeId('')
        setEditingRouteId('')
        await loadWorkspace()
        setMessage(locale==='es' ? 'Ruta actualizada.' : locale==='fr' ? 'Itinéraire mis à jour.' : 'Route updated.')
        setOpen(false)
        return
      }

      let positionQuery = client.from('routes').select('position').eq('company_id', companyId).eq('driver_id', form.driver_id).eq('route_date', form.date).in('status', routeStatuses).order('position', {ascending:false}).limit(1)
      positionQuery = branchId ? positionQuery.eq('branch_id', branchId) : positionQuery.is('branch_id', null)
      const {data: lastRoute, error: positionError} = await positionQuery.maybeSingle()
      if (positionError) throw positionError
      let queueQuery = client.from('routes').select('id,position,destination_name,mission_type,status').eq('company_id', companyId).eq('driver_id', form.driver_id).eq('route_date', form.date).in('status', ['draft','pending','published','paused']).order('position', {ascending: true})
      queueQuery = branchId ? queueQuery.eq('branch_id', branchId) : queueQuery.is('branch_id', null)
      const {data: lastQueue, error: queueError} = await queueQuery
      if (queueError) throw queueError
      payload.position = Number(lastRoute?.position || 0) + 1
      let created = await client.from('routes').insert(payload).select('id').single()
      if (created.error && /destination_contact_name|schema cache|column/i.test(created.error.message || '')) {
        delete payload.destination_contact_name
        created = await client.from('routes').insert(payload).select('id').single()
      }
      const {data: createdRoute, error} = created
      if (error) throw error
      if (createdRoute?.id) {
        const mutableIds = (lastQueue || []).map((route: {id: string}) => route.id)
        const insertionIndex = insertBeforeId ? mutableIds.indexOf(insertBeforeId) : -1
        const nextIds = mutableIds.filter((id: string) => id !== createdRoute.id)
        if (insertionIndex >= 0) nextIds.splice(insertionIndex, 0, createdRoute.id)
        else nextIds.push(createdRoute.id)
        if (nextIds.length) {
          const {error: reorderError} = await client.rpc('reorder_route_queue', {p_route_ids: nextIds})
          if (reorderError) throw reorderError
        }
      }
      if (createdRoute?.id && currentUserId) {
        await recordActivity({companyId,userId:currentUserId,action:'route_created',recordId:createdRoute.id,after:{driver_id:form.driver_id,priority:form.priority,destination:destinationAddress}}).catch(()=>undefined)
        void sendRoutePush(createdRoute.id, 'assigned')
      }
      window.dispatchEvent(new Event('routehub:notifications-refresh'))
      const requestId = searchParams.get('request')
      if (requestId) {
        const {error: requestError} = await client.from('requests').update({status:'assigned'}).eq('id', requestId).eq('company_id', companyId)
        if (requestError) throw requestError
      }
      setForm((current: {driver_id: string}) => ({...initialForm(), driver_id: current.driver_id}))
      setSelectedDestinationLocation(null)
      setInsertBeforeId('')
      await loadWorkspace()
      setMessage(c.published)
      setJustCreated(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.saveError)
    } finally {
      setSaving(false)
    }
  }

  const cancelRoute = async (route: RouteRecord) => {
    const label = route.destination_name || route.destination_address || 'route'
    const ok = window.confirm(locale==='es' ? `Cancelar ${label}?` : locale==='fr' ? `Annuler ${label} ?` : `Cancel ${label}?`)
    if (!ok) return
    try {
      const client = getSupabase()
      const {error} = await client.from('routes').update({status: 'cancelled', updated_version: Date.now()}).eq('id', route.id)
      if (error) throw error
      if (route.driver_id && route.company_id) {
        let queueQuery = client.from('routes').select('id,position').eq('company_id', route.company_id).eq('route_date', route.route_date || '').eq('driver_id', route.driver_id).in('status', ['draft', 'pending', 'published', 'paused']).order('position').order('id')
        queueQuery = route.branch_id == null ? queueQuery.is('branch_id', null) : queueQuery.eq('branch_id', route.branch_id)
        const {data: remaining, error: queueError} = await queueQuery
        if (queueError) throw queueError
        const ids = (remaining || []).map((item: {id: string}) => item.id)
        if (ids.length) {
          const {error: reorderError} = await client.rpc('reorder_route_queue', {p_route_ids: ids})
          if (reorderError) throw reorderError
        }
      }
      void sendRoutePush(route.id, 'updated')
      await loadWorkspace()
      setMessage(locale==='es' ? 'Ruta cancelada.' : locale==='fr' ? 'Itinéraire annulé.' : 'Route cancelled.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.saveError)
    }
  }

  // Moves an assigned route back to the Unassigned pool - e.g. the customer
  // wants a different time, so instead of cancelling the manager frees the
  // route to reassign later. The driver currently holding it must find out
  // immediately: the DB update clears driver_id, which realtime subscribers
  // filtered by driver_id=eq.<id> won't see once it no longer matches, so we
  // also push a notification explicitly naming that driver (captured before
  // the update, since after it the route has no driver to look up).
  const unassignRoute = async (route: RouteRecord) => {
    if (!route.driver_id || busyRouteId || routeMoveLocks.current.has(route.id)) return
    if (['completed', 'cancelled'].includes(route.status || '')) return
    const previousDriverId = route.driver_id
    const wasActive = route.status === 'active'
    routeMoveLocks.current.add(route.id)
    setBusyRouteId(route.id)
    try {
      const client = getSupabase()
      // The route the driver is actively working right now can still be
      // pulled back to Unassigned - the customer saying "come back later"
      // doesn't stop being real just because the driver already left for
      // it - but only once it's paused: that's the driver app's own signal
      // to stop treating it as "in progress" before driver_id changes under
      // it (see the guard in app/driver-v3/page.tsx that closes navigation
      // instead of silently jumping to a different stop when that happens).
      if (wasActive) {
        const {data: paused, error: pauseError} = await client.from('routes').update({status: 'paused', updated_version: Date.now()}).eq('id', route.id).eq('company_id', route.company_id).eq('status', 'active').select('id').maybeSingle()
        if (pauseError) throw pauseError
        if (!paused) throw new Error(locale === 'es' ? 'La ruta cambió antes de moverla. Actualiza la lista e intenta de nuevo.' : locale === 'fr' ? 'L’itinéraire a changé avant son déplacement. Actualisez et réessayez.' : 'The route changed before it could be moved. Refresh the list and try again.')
      }
      // Selecting the row back is what makes an RLS refusal visible: a blocked
      // update returns success with zero rows, so without this the manager
      // would get a "moved to unassigned" confirmation for a route that never
      // actually moved. toggleRoutePause guards the same way.
      // route_started_at/arrived_at are what Driver's driverOperationPhase()
      // actually checks to decide a stop is already "started" - independent
      // of status. Left set, whoever picks this route up next would open
      // Today straight into live navigation ("Ruta activa") before ever
      // pressing Start. A route that's 'paused' here only got that way from
      // its PREVIOUS driver's progress, so it goes back to 'published' too.
      const wasPaused = wasActive || route.status === 'paused'
      const {data: updated, error} = await client.from('routes').update({driver_id: null, position: null, route_started_at: null, arrived_at: null, ...(wasPaused ? {status: 'published'} : {}), updated_version: Date.now()}).eq('id', route.id).eq('company_id', route.company_id).eq('driver_id', previousDriverId).in('status', ['draft', 'pending', 'published', 'paused']).select('id').maybeSingle()
      if (error) throw error
      if (!updated) throw new Error(locale === 'es' ? 'No se pudo mover la ruta. Actualiza la lista e intenta de nuevo.' : locale === 'fr' ? 'Impossible de déplacer l’itinéraire. Actualisez la liste et réessayez.' : 'The route could not be moved. Refresh the list and try again.')
      let queueQuery = client.from('routes').select('id,position').eq('company_id', route.company_id).eq('route_date', route.route_date || '').eq('driver_id', previousDriverId).in('status', ['draft', 'pending', 'published', 'paused']).order('position').order('id')
      queueQuery = route.branch_id == null ? queueQuery.is('branch_id', null) : queueQuery.eq('branch_id', route.branch_id)
      const {data: remaining, error: queueError} = await queueQuery
      if (queueError) throw queueError
      const ids = (remaining || []).map((item: {id: string}) => item.id)
      if (ids.length) {
        const {error: reorderError} = await client.rpc('reorder_route_queue', {p_route_ids: ids})
        if (reorderError) throw reorderError
      }
      if (currentUserId && companyId) await recordActivity({companyId, userId: currentUserId, action: 'route_unassigned_by_manager', recordId: route.id, after: {previous_driver_id: previousDriverId}}).catch(() => undefined)
      void sendRoutePush(route.id, 'unassigned', previousDriverId)
      await loadWorkspace()
      setMessage(locale === 'es' ? 'Ruta movida a sin asignar.' : locale === 'fr' ? 'Itinéraire déplacé vers non attribué.' : 'Route moved to unassigned.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.saveError)
    } finally {
      routeMoveLocks.current.delete(route.id)
      setBusyRouteId('')
    }
  }

  const moveRoute = async (route: RouteRecord, direction: 'up' | 'down') => {
    if (!route.driver_id || !route.company_id) return
    if (['completed', 'cancelled', 'active'].includes(route.status || '')) return
    try {
      const client = getSupabase()
      let queueQuery = client.from('routes').select('id,position').eq('company_id', route.company_id).eq('route_date', route.route_date || '').eq('driver_id', route.driver_id).in('status', ['draft', 'pending', 'published', 'paused']).order('position').order('id')
      queueQuery = route.branch_id == null ? queueQuery.is('branch_id', null) : queueQuery.eq('branch_id', route.branch_id)
      const {data: queue, error: queueError} = await queueQuery
      if (queueError) throw queueError
      const ids = (queue || []).map((item: {id: string}) => item.id)
      const index = ids.indexOf(route.id)
      const next = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || next < 0 || next >= ids.length) return
      const swapped = [...ids]
      const current = swapped[index]
      swapped[index] = swapped[next]
      swapped[next] = current
      const {error: reorderError} = await client.rpc('reorder_route_queue', {p_route_ids: swapped})
      if (reorderError) throw reorderError
      void sendRoutePush(route.id, 'updated')
      await loadWorkspace()
      setMessage(locale==='es' ? 'Orden actualizado.' : locale==='fr' ? 'Ordre mis à jour.' : 'Queue updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.saveError)
    }
  }

  const toggleRoutePause = async (route: RouteRecord) => {
    const status = route.status || 'pending'
    if (!['active', 'paused'].includes(status) || busyRouteId) return
    const pausing = status === 'active'
    const label = route.destination_name || route.destination_address || 'route'
    const confirmation = pausing
      ? (locale === 'es' ? `¿Pausar ${label}? El conductor verá la ruta como pausada.` : locale === 'fr' ? `Mettre ${label} en pause ? Le conducteur verra l’itinéraire en pause.` : `Pause ${label}? The driver will see this route as paused.`)
      : (locale === 'es' ? `¿Reanudar ${label}?` : locale === 'fr' ? `Reprendre ${label} ?` : `Resume ${label}?`)
    if (!window.confirm(confirmation)) return
    setBusyRouteId(route.id)
    try {
      const client = getSupabase()
      const nextStatus = pausing ? 'paused' : 'active'
      const {data, error} = await client.from('routes').update({status: nextStatus, updated_version: Date.now()}).eq('id', route.id).eq('company_id', route.company_id).eq('status', status).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error(locale === 'es' ? 'La ruta cambió antes de poder actualizarla. Actualiza la lista.' : locale === 'fr' ? 'L’itinéraire a changé avant la mise à jour. Actualisez la liste.' : 'The route changed before it could be updated. Refresh the list.')
      if (currentUserId && companyId) await recordActivity({companyId, userId: currentUserId, action: pausing ? 'route_paused_by_manager' : 'route_resumed_by_manager', recordId: route.id, after: {status: nextStatus}}).catch(() => undefined)
      void sendRoutePush(route.id, 'updated')
      await loadWorkspace()
      setMessage(pausing ? (locale === 'es' ? 'Ruta pausada.' : locale === 'fr' ? 'Itinéraire en pause.' : 'Route paused.') : (locale === 'es' ? 'Ruta reanudada.' : locale === 'fr' ? 'Itinéraire reprise.' : 'Route resumed.'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.saveError)
    } finally {
      setBusyRouteId('')
    }
  }

  const assignRouteToDriver = async (route: RouteRecord, driverId: string) => {
    if (!driverId || busyRouteId || route.driver_id === driverId || routeMoveLocks.current.has(route.id)) return
    if (!['draft', 'pending', 'published', 'paused'].includes(route.status || '')) return
    routeMoveLocks.current.add(route.id)
    setBusyRouteId(route.id)
    try {
      const client = getSupabase()
      // Reassign this existing row atomically. This keeps the same route ID and
      // lets the database normalize both queues in one operation, so retries
      // cannot create a second copy or leave duplicate positions behind.
      const {data, error} = await client.rpc('reassign_upcoming_route', {p_route_id: route.id, p_driver_id: driverId})
      if (error) throw error
      if (!Array.isArray(data) || data.length !== 1 || data[0]?.id !== route.id) throw new Error(locale === 'es' ? 'La ruta cambió antes de moverla. Actualiza la lista e intenta de nuevo.' : locale === 'fr' ? 'L’itinéraire a changé avant son déplacement. Actualisez et réessayez.' : 'The route changed before it could be moved. Refresh the list and try again.')
      if (route.driver_id) void sendRoutePush(route.id, 'unassigned', route.driver_id)
      void sendRoutePush(route.id, 'assigned')
      await loadWorkspace()
      setMessage(locale === 'es' ? 'Ruta movida.' : locale === 'fr' ? 'Itinéraire déplacé.' : 'Route moved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.saveError)
    } finally {
      routeMoveLocks.current.delete(route.id)
      setBusyRouteId('')
    }
  }

  // Backs the drag-and-drop board: dropping a route onto another route's
  // card assigns it to that card's driver (or keeps the same driver, if
  // reordering within one queue) and inserts it exactly where it was
  // dropped, instead of just appending it - "drop it where the delivery
  // would actually happen" per the founder's own description of the flow.
  // A route the driver is currently working (status 'active') is paused
  // first as part of the same action: unassignRoute/assignRouteToDriver
  // both refuse an active row outright, and pausing is also the driver
  // app's own signal to stop treating it as "in progress" before its
  // driver_id or queue position changes underneath it - see the guard in
  // app/driver-v3/page.tsx that closes navigation instead of silently
  // jumping to a different stop when that happens.
  const moveRouteToPosition = async (route: RouteRecord, targetDriverId: string, beforeRouteId: string | null) => {
    if (!targetDriverId || busyRouteId || routeMoveLocks.current.has(route.id)) return
    if (['completed', 'cancelled'].includes(route.status || '')) return
    const previousDriverId = route.driver_id || null
    if (previousDriverId === targetDriverId && beforeRouteId === route.id) return
    const wasActive = route.status === 'active'
    routeMoveLocks.current.add(route.id)
    setBusyRouteId(route.id)
    try {
      const client = getSupabase()
      if (wasActive) {
        const {data: paused, error: pauseError} = await client.from('routes').update({status: 'paused', updated_version: Date.now()}).eq('id', route.id).eq('company_id', route.company_id).eq('status', 'active').select('id').maybeSingle()
        if (pauseError) throw pauseError
        if (!paused) throw new Error(locale === 'es' ? 'La ruta cambió antes de moverla. Actualiza la lista e intenta de nuevo.' : locale === 'fr' ? 'L’itinéraire a changé avant son déplacement. Actualisez et réessayez.' : 'The route changed before it could be moved. Refresh the list and try again.')
      }
      if (previousDriverId !== targetDriverId) {
        const {data, error} = await client.rpc('reassign_upcoming_route', {p_route_id: route.id, p_driver_id: targetDriverId})
        if (error) throw error
        if (!Array.isArray(data) || data.length !== 1 || data[0]?.id !== route.id) throw new Error(locale === 'es' ? 'La ruta cambió antes de moverla. Actualiza la lista e intenta de nuevo.' : locale === 'fr' ? 'L’itinéraire a changé avant son déplacement. Actualisez et réessayez.' : 'The route changed before it could be moved. Refresh the list and try again.')
      }
      let queueQuery = client.from('routes').select('id,position').eq('company_id', route.company_id).eq('route_date', route.route_date || '').eq('driver_id', targetDriverId).in('status', ['draft', 'pending', 'published', 'paused']).order('position').order('id')
      queueQuery = route.branch_id == null ? queueQuery.is('branch_id', null) : queueQuery.eq('branch_id', route.branch_id)
      const {data: queue, error: queueError} = await queueQuery
      if (queueError) throw queueError
      const ids = (queue || []).map((item: {id: string}) => item.id).filter((id: string) => id !== route.id)
      const insertAt = beforeRouteId ? ids.indexOf(beforeRouteId) : -1
      if (insertAt < 0) ids.push(route.id)
      else ids.splice(insertAt, 0, route.id)
      const {error: reorderError} = await client.rpc('reorder_route_queue', {p_route_ids: ids})
      if (reorderError) throw reorderError
      if (currentUserId && companyId) await recordActivity({companyId, userId: currentUserId, action: 'route_moved_by_manager', recordId: route.id, after: {driver_id: targetDriverId}}).catch(() => undefined)
      if (previousDriverId && previousDriverId !== targetDriverId) void sendRoutePush(route.id, 'unassigned', previousDriverId)
      void sendRoutePush(route.id, previousDriverId !== targetDriverId ? 'assigned' : 'updated')
      await loadWorkspace()
      setMessage(locale === 'es' ? 'Ruta movida.' : locale === 'fr' ? 'Itinéraire déplacé.' : 'Route moved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.saveError)
    } finally {
      routeMoveLocks.current.delete(route.id)
      setBusyRouteId('')
    }
  }

  const renderRouteCards = (_items: RouteRecord[]) => null

  return {save, renderRouteCards, cancelRoute, moveRoute, toggleRoutePause, assignRouteToDriver, unassignRoute, moveRouteToPosition, busyRouteId}
}
