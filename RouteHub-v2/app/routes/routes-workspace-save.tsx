'use client'

import Link from 'next/link'
import {ArrowRight, CalendarDays, ChevronRight, CircleDot, MapPin, PackageCheck, UserRound} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {sanitizeCoordinate} from '../../lib/maps/coordinates'
import {geocodeAddress} from '../../lib/maps/geocoding'
import {recordActivity} from '../../lib/activity'
import {sendRoutePush} from '../../lib/route-push'
import styles from './routes.module.css'
import type {RouteRecord} from './routes-model'
import {driverDetails, initialForm, routeDate, routeStatuses, routeTime, savedCoordinate, statusLabel, typeLabel} from './routes-model'

export function useRoutesSave(w: any) {
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
      const selected = contacts.find((contact: {id: string}) => contact.id === form.contact_id)
      const destinationAddress = selected?.address || form.destination.trim()
      const destinationName = selected?.company_name || form.destination_label.trim() || form.destination.trim()
      const destinationPhone = form.destination_phone.trim() || selected?.phone || null
      const destinationContactName = form.stop_contact_name.trim() || selected?.contact_name || null
      let originCoordinate = originMode === 'branch' ? originBranchCoordinate : originMode === 'previous' ? previousDestinationCoordinate : originMode === 'contact' ? originContactCoordinate : originMode === 'custom' ? selectedDriverGps : null
      let destinationCoordinate = form.type === 'return' ? returnBranchCoordinate : sanitizeCoordinate(selectedDestinationLocation?.coordinate) || savedCoordinate(selected)
      const persistedDestinationAddress = form.type === 'return' ? returnBranch?.address || returnBranch?.name || destinationAddress : destinationAddress
      const persistedDestinationName = form.type === 'return' ? returnBranch?.name || destinationName : destinationName
      const persistedOriginAddress = originBranch?.address || form.origin.trim() || defaultBranch?.address || defaultBranch?.name || c.branch
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
        origin_name: originMode === 'branch' ? originBranch?.name || c.branch : originMode === 'previous' ? previousRoute?.destination_name || form.origin.trim() : contacts.find((contact: {address: string}) => contact.address === form.origin)?.company_name || form.origin.trim(),
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

  const renderRouteCards = (items: RouteRecord[]) => items.map((route, index) => {
    const details = driverDetails(route.driver_id ? driverIndex.get(route.driver_id) : undefined,c.teamDriver)
    const origin = route.origin_name || route.origin_address || c.branch
    const destination = route.destination_name || route.destination_address || c.destinationPending
    const priority = route.priority || 'normal'
    const status = route.status || 'pending'
    const statusTone = status === 'completed' ? styles.routeToneCompleted : status === 'issue' ? styles.routeToneIssue : status === 'cancelled' ? styles.routeToneCancelled : ['active','paused'].includes(status) ? styles.routeToneActive : styles.routeTonePending
    return <article className={`${styles.routeCard} ${statusTone} ${priority === 'urgent' ? styles.urgentCard : ''}`} key={route.id}>
      <div className={styles.cardTop}>
        <div className={styles.routeIdentity}><span className={styles.routeNumber}>{String(route.position || index + 1).padStart(2, '0')}</span><div><small className={`${styles.routeTypeLabel} ${styles[`routeType_${route.mission_type}`] || ''}`}>{typeLabel(route.mission_type,c)}</small><strong>{destination}</strong></div></div>
        <div className={`${styles.statusBadge} ${styles[`status_${status}`] || ''}`}><CircleDot size={12}/>{statusLabel(status,c)}</div>
      </div>
      <div className={styles.routePath}><MapPin size={17}/><span>{origin}</span><ArrowRight size={16}/><strong>{destination}</strong></div>
      <div className={styles.routeDetails}>
        <div><UserRound size={16}/><span><strong>{details.name}</strong>{details.email && <small>{details.email}</small>}</span></div>
        <div><CalendarDays size={16}/><span><strong>{routeDate(route,locale,c)}</strong><small>{routeTime(route,locale,c)}</small></span></div>
        {route.mission_type==='pickup'&&<div><PackageCheck size={16}/><span><strong>{route.order_number || c.noPo}</strong><small>{c.orderReference}</small></span></div>}
        {route.mission_type==='delivery'&&route.order_number&&<div><PackageCheck size={16}/><span><strong>{route.order_number}</strong><small>{locale==='es'?'Trabajo / orden':locale==='fr'?'Chantier / commande':'Job / order'}</small></span></div>}
      </div>
      <div className={styles.cardFooter}>
        <span className={`${styles.priorityBadge} ${styles[`priority_${priority}`] || ''}`}>{priority==='urgent'?c.urgent:priority==='priority'?c.priorityName:c.normal}</span>
        <Link href="/routes/manage">{c.viewManage}<ChevronRight size={16}/></Link>
      </div>
    </article>
  })

  return {save, renderRouteCards}
}
