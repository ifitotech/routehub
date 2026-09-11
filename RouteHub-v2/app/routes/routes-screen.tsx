'use client'

export const dynamic = 'force-dynamic'

import {useEffect, useMemo, useState} from 'react'
import Link from 'next/link'
import {AlertTriangle, ArrowRight, Map, Plus, Route as RouteIcon, Users} from 'lucide-react'
import RouteRows from './routes-rows'
import ManagerShell from '../manager/manager-shell'
import NewRouteDialog from './new-route-dialog'
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

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('manage') === '1') setManaging(true)
      if (params.get('pane') === 'map') setPane('map')
    } catch {}
  }, [])

  const {c, locale, t, defaultBranch, open, saving, justCreated, previewOpen, form, setForm, selectedContact, originMode, detailsOpen, setDetailsOpen, todayValue, oc, branches, contacts, drivers, save, pendingLocation, setPendingLocation, useConfirmedDestination, updateDestination, destinationSuggestions, selectDestinationContact, selectExternalDestination, searchContext, selectedDestinationLocation, setSelectedDestinationLocation, insertBeforeId, setInsertBeforeId, priorityRoutes, saveContactOpen, setSaveContactOpen, contactSaveMessage, setContactSaveMessage, newContactName, setNewContactName, savingContact, saveDestinationAsContact, planningMapRoutes, setOpen, setPreviewOpen, setOriginSource, selectDriver, openBuilder, message, cancelRoute, moveRoute, toggleRoutePause, assignRouteToDriver, unassignRoute, busyRouteId, driverIndex, loading} = w

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

  // Calculate route counts for calendar badges
  const routeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    routesByDateAndStatus.forEach((dateRoutes, date) => {
      const total = (dateRoutes.unassigned?.length || 0) +
                    (dateRoutes['in-progress']?.length || 0) +
                    (dateRoutes.pending?.length || 0) +
                    (dateRoutes.completed?.length || 0) +
                    (dateRoutes.issues?.length || 0)
      counts[date] = total
    })
    return counts
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
            <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button>
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
              busyRouteId={busyRouteId}
              locale={locale}
            />
          }
          center={
            <div>
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
                    busyRouteId={busyRouteId}
                    managing={managing}
                  />
                </section>
              ) : (
                <section className={styles.emptyState}>
                  <div><RouteIcon size={28}/></div>
                  <h2>{locale==='es'?'Sin rutas asignadas':locale==='fr'?'Aucun itinéraire attribué':'No assigned routes'}</h2>
                  <p>{locale==='es'?'Asigna rutas desde la lista de la izquierda para verlas aquí.':locale==='fr'?'Attribuez des itinéraires depuis la liste de gauche pour les voir ici.':'Assign routes from the list on the left to see them here.'}</p>
                  <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button>
                </section>
              )}
            </div>
          }
          map={<RoutesBoard routes={mapRoutes} locale={locale} />}
          pane={pane}
        />
      </div>

      {open && <NewRouteDialog
        open={open}
        saving={saving}
        setOpen={setOpen}
        justCreated={justCreated}
        locale={locale}
        c={c}
        openBuilder={openBuilder}
        previewOpen={previewOpen}
        setPreviewOpen={setPreviewOpen}
        form={form}
        setForm={setForm}
        selectedContact={selectedContact}
        originMode={originMode}
        setOriginSource={setOriginSource}
        selectDriver={selectDriver}
        oc={oc}
        branches={branches}
        contacts={contacts}
        defaultBranch={defaultBranch}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        todayValue={todayValue}
        drivers={drivers}
        save={save}
        pendingLocation={pendingLocation}
        setPendingLocation={setPendingLocation}
        useConfirmedDestination={useConfirmedDestination}
        updateDestination={updateDestination}
        destinationSuggestions={destinationSuggestions}
        selectDestinationContact={selectDestinationContact}
        selectExternalDestination={selectExternalDestination}
        searchContext={searchContext}
        selectedDestinationLocation={selectedDestinationLocation}
        setSelectedDestinationLocation={setSelectedDestinationLocation}
        insertBeforeId={insertBeforeId}
        setInsertBeforeId={setInsertBeforeId}
        priorityRoutes={priorityRoutes}
        saveContactOpen={saveContactOpen}
        setSaveContactOpen={setSaveContactOpen}
        contactSaveMessage={contactSaveMessage}
        setContactSaveMessage={setContactSaveMessage}
        newContactName={newContactName}
        setNewContactName={setNewContactName}
        savingContact={savingContact}
        saveDestinationAsContact={saveDestinationAsContact}
        planningMapRoutes={planningMapRoutes}
      />}
    </ManagerShell>
  )
}
