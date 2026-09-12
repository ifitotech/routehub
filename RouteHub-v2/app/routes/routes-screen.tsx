'use client'

export const dynamic = 'force-dynamic'

import {useEffect, useMemo, useState} from 'react'
import Link from 'next/link'
import {AlertTriangle, ArrowRight, Map, Plus, Route as RouteIcon, Users, X} from 'lucide-react'
import RouteRows from './routes-rows'
import ManagerShell from '../manager/manager-shell'
import NewRoutePanel from './new-route-panel'
import RouteDetailView from './route-detail-view'
import RoutesBoard from './routes-board'
import DispatchCalendar from './dispatch-calendar'
import UnassignedPanel from './unassigned-panel'
import DispatchLayout from './dispatch-layout'
import DriverDropdown from './driver-dropdown'
import DailyProgress from './daily-progress'
import RouteSearch from './route-search'
import styles from './routes.module.css'
import board from './routes-board.module.css'
import './routes-dispatch.css'
import {useRoutesWorkspace} from './routes-workspace'

export default function Routes() {
  const w = useRoutesWorkspace()
  const [pane, setPane] = useState<'list' | 'map'>('list')
  const [managing, setManaging] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => w.todayValue)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [assignDropActive, setAssignDropActive] = useState(false)
  const [viewingRouteId, setViewingRouteId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('manage') === '1') setManaging(true)
      if (params.get('pane') === 'map') setPane('map')
    } catch {}
  }, [])

  const {c, locale, t, defaultBranch, open, saving, justCreated, previewOpen, form, setForm, selectedContact, originMode, detailsOpen, setDetailsOpen, todayValue, oc, branches, contacts, drivers, save, pendingLocation, setPendingLocation, useConfirmedDestination, updateDestination, destinationSuggestions, selectDestinationContact, selectExternalDestination, searchContext, selectedDestinationLocation, setSelectedDestinationLocation, insertBeforeId, setInsertBeforeId, priorityRoutes, saveContactOpen, setSaveContactOpen, contactSaveMessage, setContactSaveMessage, newContactName, setNewContactName, savingContact, saveDestinationAsContact, planningMapRoutes, setOpen, setPreviewOpen, setOriginSource, selectDriver, openBuilder, message, cancelRoute, moveRoute, toggleRoutePause, assignRouteToDriver, unassignRoute, busyRouteId, driverIndex, loading} = w

  // Add Route opens defaulted to whichever date was selected in the
  // calendar strip - but tapping a different day in that strip while the
  // form is still open used to leave it stuck on the day it opened with.
  // Keep it live: any calendar tap updates the open form's date too.
  useEffect(() => {
    if (!open) return
    // Opening Add Route while a completed route's details were showing
    // would otherwise leave both "open" - the details view takes priority
    // in the center column's render order, so the form would silently
    // never appear.
    setViewingRouteId(null)
    // A route can't be scheduled in the past - closing the form here
    // instead of just refusing to update its date, since there's nothing
    // useful left for it to do once the calendar has moved before today.
    if (selectedDate < todayValue) { setOpen(false); return }
    setForm(current => current.date === selectedDate ? current : {...current, date: selectedDate})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, open])

  // Get routes for selected date and status from new unified data structure
  const routesByDateAndStatus = useMemo(() => w.routesByDateAndStatus, [w.routesByDateAndStatus])

  const currentDateRoutes = useMemo(() => {
    return routesByDateAndStatus.get(selectedDate) || {
      unassigned: [],
      'in-progress': [],
      pending: [],
      completed: [],
      issues: [],
    }
  }, [routesByDateAndStatus, selectedDate])

  // Driver selection is a top-level context filter: it narrows every bucket
  // (sidebar counts, daily progress, map, list) consistently, not just the list.
  const scopedRoutes = useMemo(() => {
    if (!selectedDriverId) return currentDateRoutes
    const byDriver = (list: any[]) => list.filter(r => r.driver_id === selectedDriverId)
    return {
      unassigned: byDriver(currentDateRoutes.unassigned || []),
      'in-progress': byDriver(currentDateRoutes['in-progress'] || []),
      pending: byDriver(currentDateRoutes.pending || []),
      completed: byDriver(currentDateRoutes.completed || []),
      issues: byDriver(currentDateRoutes.issues || []),
    }
  }, [currentDateRoutes, selectedDriverId])

  // Routes waiting for a driver - the left panel's job
  const unassignedRoutes = scopedRoutes.unassigned || []

  // Routes already assigned - the center queue, reorderable when managing.
  // Active work first, then what's queued, then issues, then what's done.
  const assignedRoutes = useMemo(() => {
    let combined = [
      ...(scopedRoutes['in-progress'] || []),
      ...(scopedRoutes.pending || []),
      ...(scopedRoutes.issues || []),
      ...(scopedRoutes.completed || []),
    ]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      combined = combined.filter((r: any) => {
        const destination = (r.destination_address || r.destination_name || '').toLowerCase()
        return destination.includes(query)
      })
    }

    return combined
  }, [scopedRoutes, searchQuery])

  const viewingRoute = viewingRouteId ? assignedRoutes.find((r: any) => r.id === viewingRouteId) : null

  // Calculate driver stats for current date
  const driverStats = useMemo(() => {
    const stats: Record<string, {active: number; total: number}> = {}
    if (!currentDateRoutes) return stats

    Object.values(currentDateRoutes).forEach((routeList: any) => {
      routeList.forEach((route: any) => {
        if (!route.driver_id) return
        if (!stats[route.driver_id]) stats[route.driver_id] = {active: 0, total: 0}
        stats[route.driver_id].total++
        if (['active', 'paused'].includes(route.status || '')) {
          stats[route.driver_id].active++
        }
      })
    })
    return stats
  }, [currentDateRoutes])

  // Calendar badges: the total per day, plus how much of it is still waiting
  // to be done, so only days with outstanding work are highlighted.
  const {routeCounts, pendingCounts} = useMemo(() => {
    const counts: Record<string, number> = {}
    const pending: Record<string, number> = {}
    routesByDateAndStatus.forEach((dateRoutes, date) => {
      const waiting = (dateRoutes.unassigned?.length || 0) + (dateRoutes.pending?.length || 0)
      counts[date] = waiting +
                     (dateRoutes['in-progress']?.length || 0) +
                     (dateRoutes.completed?.length || 0) +
                     (dateRoutes.issues?.length || 0)
      pending[date] = waiting
    })
    return {routeCounts: counts, pendingCounts: pending}
  }, [routesByDateAndStatus])

  // Calculate daily progress totals
  const dailyProgress = useMemo(() => {
    const total = (scopedRoutes.unassigned?.length || 0) +
                  (scopedRoutes['in-progress']?.length || 0) +
                  (scopedRoutes.pending?.length || 0) +
                  (scopedRoutes.completed?.length || 0) +
                  (scopedRoutes.issues?.length || 0)
    return {
      total,
      completed: scopedRoutes.completed?.length || 0,
      inProgress: scopedRoutes['in-progress']?.length || 0,
      pending: scopedRoutes.pending?.length || 0,
      issues: scopedRoutes.issues?.length || 0,
    }
  }, [scopedRoutes])

  // Dropping an unassigned route on the board assigns it to whichever driver
  // the board is currently showing. With "All" selected and several drivers
  // there's no unambiguous target, so the drop is refused and the panel's
  // own driver picker stays the way to choose.
  const dropTargetDriverId = selectedDriverId || (drivers.length === 1 ? drivers[0].user_id : null)

  // Build map routes from selected date (respects driver filter)
  const mapRoutes = useMemo(() => {
    const allRoutesForDay = [
      ...(scopedRoutes.unassigned || []),
      ...(scopedRoutes['in-progress'] || []),
      ...(scopedRoutes.pending || []),
      ...(scopedRoutes.completed || []),
      ...(scopedRoutes.issues || []),
    ]
    return allRoutesForDay.map((route: any) => ({
      id: route.id,
      origin_address: route.origin_address,
      destination_address: route.destination_address,
      destination_name: route.destination_name,
      origin_lat: route.origin_lat,
      origin_lng: route.origin_lng,
      destination_lat: route.destination_lat,
      destination_lng: route.destination_lng,
      status: route.status,
      driver_id: route.driver_id,
      position: route.position,
    }))
  }, [scopedRoutes])

  return (
    <ManagerShell active="routes" branchName={defaultBranch?.name} roleLabel={t.managerRole}>
      <div className={styles.page} data-routes-dispatch>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <p className={styles.eyebrow}>{c.operations.toUpperCase()}</p>
            <h1>{c.title}</h1>
          </div>
          <div className={styles.headerTools}>
            <DailyProgress
              total={dailyProgress.total}
              completed={dailyProgress.completed}
              inProgress={dailyProgress.inProgress}
              pending={dailyProgress.pending}
              issues={dailyProgress.issues}
              locale={locale}
            />
            <RouteSearch value={searchQuery} onChange={setSearchQuery} locale={locale} />
          </div>
          <div className={styles.headerActions}>
            <DriverDropdown
              drivers={drivers}
              selectedDriverId={selectedDriverId}
              onDriverSelect={setSelectedDriverId}
              driverStats={driverStats}
              locale={locale}
            />
            <Link className={styles.secondaryButton} href="/contacts"><Users size={18}/>{t.contacts}</Link>
            <button className={styles.secondaryButton} type="button" data-on={managing ? 'true' : 'false'} onClick={() => { setManaging(on => !on); setPane('list') }}>
              <RouteIcon size={18}/>{c.manage}
            </button>
            {open
              ? <button className={styles.secondaryButton} type="button" onClick={() => setOpen(false)}><X size={18}/>{locale==='es'?'Cancelar':locale==='fr'?'Annuler':'Cancel'}</button>
              : <button className={styles.primaryButton} type="button" onClick={() => openBuilder(selectedDate)}><Plus size={18}/>{c.add}</button>}
          </div>
        </header>

        {message && <div className={message.includes('successfully') || message.includes('publicad') ? styles.successMessage : styles.message} role="status">{message}</div>}

        {!loading && (scopedRoutes.issues?.length || 0) > 0 && (
          <Link href="/routes/issues" className={styles.attentionBanner} data-tone="alert">
            <AlertTriangle size={18}/>
            <span>
              {scopedRoutes.issues!.length} {locale==='es'?'incidencia(s) abierta(s)':locale==='fr'?'incident(s) ouvert(s)':'open issue(s)'}
            </span>
            <ArrowRight size={16}/>
          </Link>
        )}

        <div className={styles.calendarRow}>
          <DispatchCalendar
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            locale={locale}
            routeCounts={routeCounts}
            pendingCounts={pendingCounts}
          />
          <button type="button" className={styles.mapShortcut} onClick={() => setPane('map')} aria-label={locale==='es'?'Ver mapa':locale==='fr'?'Voir la carte':'View map'}>
            <Map size={16}/>
          </button>
        </div>

        <div className={board.mobileToggle}>
          <button type="button" data-on={pane === 'list' ? 'true' : 'false'} onClick={() => setPane('list')}>{locale==='es'?'Lista':locale==='fr'?'Liste':'List'}</button>
          <button type="button" data-on={pane === 'map' ? 'true' : 'false'} onClick={() => setPane('map')}>{locale==='es'?'Mapa':locale==='fr'?'Carte':'Map'}</button>
        </div>

        <DispatchLayout
          sidebar={
            <UnassignedPanel
              routes={unassignedRoutes}
              drivers={drivers}
              onAssign={assignRouteToDriver}
              onDropRoute={(routeId: string) => {
                const dropped = assignedRoutes.find((r: any) => r.id === routeId)
                if (dropped) unassignRoute(dropped)
              }}
              busyRouteId={busyRouteId}
              managing={managing}
              locale={locale}
            />
          }
          center={
            viewingRoute ? (
              <RouteDetailView route={viewingRoute} locale={locale} c={c} driverIndex={driverIndex} onClose={() => setViewingRouteId(null)}/>
            ) : open ? (
              <div className={styles.formViewFade}>
                <NewRoutePanel
                  saving={saving} setOpen={setOpen} justCreated={justCreated} locale={locale} c={c} openBuilder={() => openBuilder(selectedDate)}
                  form={form} setForm={setForm} selectedContact={selectedContact} originMode={originMode} setOriginSource={setOriginSource}
                  selectDriver={selectDriver} oc={oc} branches={branches} contacts={contacts} defaultBranch={defaultBranch}
                  detailsOpen={detailsOpen} setDetailsOpen={setDetailsOpen} todayValue={todayValue} drivers={drivers} save={save}
                  pendingLocation={pendingLocation} setPendingLocation={setPendingLocation} useConfirmedDestination={useConfirmedDestination}
                  updateDestination={updateDestination} destinationSuggestions={destinationSuggestions} selectDestinationContact={selectDestinationContact}
                  selectExternalDestination={selectExternalDestination} searchContext={searchContext} selectedDestinationLocation={selectedDestinationLocation}
                  setSelectedDestinationLocation={setSelectedDestinationLocation} insertBeforeId={insertBeforeId} setInsertBeforeId={setInsertBeforeId}
                  priorityRoutes={priorityRoutes} saveContactOpen={saveContactOpen} setSaveContactOpen={setSaveContactOpen}
                  contactSaveMessage={contactSaveMessage} setContactSaveMessage={setContactSaveMessage} newContactName={newContactName}
                  setNewContactName={setNewContactName} savingContact={savingContact} saveDestinationAsContact={saveDestinationAsContact}
                />
              </div>
            ) : (
              <div
                className={styles.assignDropZone}
                data-drop-active={assignDropActive ? 'true' : 'false'}
                onDragOver={managing ? event => { event.preventDefault(); event.dataTransfer.dropEffect = dropTargetDriverId ? 'move' : 'none'; if (!assignDropActive) setAssignDropActive(true) } : undefined}
                onDragLeave={managing ? event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setAssignDropActive(false) } : undefined}
                onDrop={managing ? event => {
                  event.preventDefault()
                  setAssignDropActive(false)
                  const routeId = event.dataTransfer.getData('text/plain')
                  const dropped = unassignedRoutes.find((r: any) => r.id === routeId)
                  if (dropped && dropTargetDriverId) assignRouteToDriver(dropped, dropTargetDriverId)
                } : undefined}
              >
                {assignDropActive && (
                  <p className={styles.assignDropHint} data-tone={dropTargetDriverId ? 'ready' : 'blocked'}>
                    {dropTargetDriverId
                      ? (locale==='es'?'Suelta aquí para asignar':locale==='fr'?'Déposez ici pour attribuer':'Drop here to assign')
                      : (locale==='es'?'Elige un conductor arriba para asignar arrastrando':locale==='fr'?'Choisissez un conducteur ci-dessus pour attribuer par glisser':'Pick a driver above to assign by dragging')}
                  </p>
                )}
                {managing && <p className={board.manageHint}>{locale==='es'?'Sube, baja o cancela las rutas aqui. No se abre otra pagina.':locale==='fr'?'Montez, descendez ou annulez ici. Aucune autre page.':'Move or cancel routes here. Stay on this page.'}</p>}
                {loading ? (
                  <section className={styles.routeGrid} aria-label={c.loadError}>
                    {[0, 1, 2].map(item => <div className={styles.skeletonCard} key={item}><i/><b/><span/></div>)}
                  </section>
                ) : assignedRoutes.length > 0 ? (
                  <section className={styles.routeSection}>
                    <div className={styles.sectionHeading}>
                      <h2>{locale==='es'?'Asignadas':locale==='fr'?'Attribuées':'Assigned'}</h2>
                      <span>{assignedRoutes.length}</span>
                    </div>
                    <RouteRows
                      items={assignedRoutes}
                      locale={locale}
                      c={c}
                      driverIndex={driverIndex}
                      onCancel={cancelRoute}
                      onMove={moveRoute}
                      onTogglePause={toggleRoutePause}
                      onUnassign={unassignRoute}
                      onViewDetails={setViewingRouteId}
                      busyRouteId={busyRouteId}
                      managing={managing}
                    />
                  </section>
                ) : (
                  <section className={styles.emptyState}>
                    <div><RouteIcon size={28}/></div>
                    <h2>{locale==='es'?'Sin rutas asignadas':locale==='fr'?'Aucun itinéraire attribué':'No assigned routes'}</h2>
                    <p>{locale==='es'?'Asigna rutas desde la lista de la izquierda para verlas aquí.':locale==='fr'?'Attribuez des itinéraires depuis la liste de gauche pour les voir ici.':'Assign routes from the list on the left to see them here.'}</p>
                    <button className={styles.primaryButton} type="button" onClick={() => openBuilder(selectedDate)}><Plus size={18}/>{c.add}</button>
                  </section>
                )}
              </div>
            )
          }
          map={<RoutesBoard routes={open ? (planningMapRoutes || []) : mapRoutes} locale={locale} />}
          pane={pane}
          focus={open || Boolean(viewingRoute)}
        />
      </div>
    </ManagerShell>
  )
}
