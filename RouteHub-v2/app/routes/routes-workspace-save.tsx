'use client'

import {useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {sanitizeCoordinate} from '../../lib/maps/coordinates'
import {geocodeAddress} from '../../lib/maps/geocoding'
import {recordActivity} from '../../lib/activity'
import {sendRoutePush} from '../../lib/route-push'
import type {RouteRecord} from './routes-model'
import {initialForm, routeStatuses, savedCoordinate} from './routes-model'

export function useRoutesSave(w: any) {
  const [busyRouteId, setBusyRouteId] = useState('')
  const {
    saving, form, contacts, companyId, c, setMessage, setSaving, originMode,
    originBranchCoordinate, previousDestinationCoordinate, originContactCoordinate,
    selectedDriverGps, returnBranchCoordinate, selectedDestinationLocation, returnBranch,
    originBranch, defaultBranch, branchId, previousRoute, insertBeforeId, currentUserId,
    searchParams, setForm, setSelectedDestinationLocation, setInsertBeforeId, loadWorkspace,
    setJustCreated, locale, driverIndex,
  } = w
  const save = async () => {
    if (saving) return
    if (!form.destination.trim() || !form.driver_id) {
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
      let positionQuery = client.from('routes').select('position').eq('company_id', companyId).eq('driver_id', form.driver_id).eq('route_date', form.date).in('status', routeStatuses).order('position', {ascending:false}).limit(1)
      positionQuery = branchId ? positionQuery.eq('branch_id', branchId) : positionQuery.is('branch_id', null)
      const {data: lastRoute, error: positionError} = await positionQuery.maybeSingle()
      if (positionError) throw positionError
      let queueQuery = client.from('routes').select('id,position,destination_name,mission_type,status').eq('company_id', companyId).eq('driver_id', form.driver_id).eq('route_date', form.date).in('status', ['draft','pending','published','paused']).order('position', {ascending: true})
      queueQuery = branchId ? queueQuery.eq('branch_id', branchId) : queueQuery.is('branch_id', null)
      const {data: lastQueue, error: queueError} = await queueQuery
      if (queueError) throw queueError
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
        position: Number(lastRoute?.position || 0) + 1,
      }
      if (destinationContactName) payload.destination_contact_name = destinationContactName
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

  const renderRouteCards = (_items: RouteRecord[]) => null

  return {save, renderRouteCards, cancelRoute, moveRoute, toggleRoutePause, busyRouteId}
}
