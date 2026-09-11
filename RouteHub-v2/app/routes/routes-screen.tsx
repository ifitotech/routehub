'use client'

export const dynamic = 'force-dynamic'

import {useEffect, useMemo, useState} from 'react'
import Link from 'next/link'
import {AlertTriangle, CheckCircle, Clock3, Map, PlayCircle, Plus, Route as RouteIcon, Truck, Users} from 'lucide-react'
import RouteRows from './routes-rows'
import ManagerShell from '../manager/manager-shell'
import NewRouteDialog from './new-route-dialog'
import RoutesBoard from './routes-board'
import DispatchCalendar from './dispatch-calendar'
import StatusSidebar from './status-sidebar'
import DispatchLayout from './dispatch-layout'
import VehicleSelector from './vehicle-selector'
import RouteDetailsPanel from './route-details-panel'
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
  const [selectedStatus, setSelectedStatus] = useState<'in-progress' | 'pending' | 'unassigned' | 'completed' | 'issues'>('in-progress')
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('manage') === '1') setManaging(true)
    } catch {}
  }, [])

  const {c, locale, t, defaultBranch, open, saving, justCreated, previewOpen, form, setForm, selectedContact, originMode, detailsOpen, setDetailsOpen, todayValue, oc, branches, contacts, drivers, save, pendingLocation, setPendingLocation, useConfirmedDestination, updateDestination, destinationSuggestions, selectDestinationContact, selectExternalDestination, searchContext, selectedDestinationLocation, setSelectedDestinationLocation, insertBeforeId, setInsertBeforeId, priorityRoutes, saveContactOpen, setSaveContactOpen, contactSaveMessage, setContactSaveMessage, newContactName, setNewContactName, savingContact, saveDestinationAsContact, planningMapRoutes, setOpen, setPreviewOpen, setOriginSource, selectDriver, openBuilder, message, cancelRoute, moveRoute, toggleRoutePause, busyRouteId, driverIndex, loading, routes} = w

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

  const routesForSelectedStatus = useMemo(() => {
    let routes = scopedRoutes[selectedStatus as keyof typeof scopedRoutes] || []

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      routes = routes.filter((r: any) => {
        const destination = (r.destination_address || r.destination_name || '').toLowerCase()
        return destination.includes(query)
      })
    }

    return routes
  }, [scopedRoutes, selectedStatus, searchQuery])

  // Get selected route details
  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return null
    return routesForSelectedStatus.find((r: any) => r.id === selectedRouteId) || null
  }, [selectedRouteId, routesForSelectedStatus])

  const selectedRouteDis = useMemo(() => {
    if (!selectedRoute || !selectedRoute.driver_id) return null
    return selectedRoute.driver_id
  }, [selectedRoute])

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

  // Status sections for sidebar with live counts from selected date
  const statusSections = useMemo(() => {
    const getLabel = (key: string): string => {
      const labels: Record<string, Record<string, string>> = {
        es: {unassigned: 'No asignadas', 'in-progress': 'En curso', pending: 'Pendientes', completed: 'Completadas', issues: 'Incidencias'},
        fr: {unassigned: 'Non attribuées', 'in-progress': 'En cours', pending: 'En attente', completed: 'Terminées', issues: 'Incidents'},
        en: {unassigned: 'Unassigned', 'in-progress': 'In Progress', pending: 'Pending', completed: 'Completed', issues: 'Issues'},
      }
      return labels[locale]?.[key] || labels.en[key] || key
    }

    const icons = {
      unassigned: <Truck size={18} />,
      'in-progress': <PlayCircle size={18} />,
      pending: <Clock3 size={18} />,
      completed: <CheckCircle size={18} />,
      issues: <AlertTriangle size={18} />,
    }

    return [
      {status: 'unassigned', label: getLabel('unassigned'), count: scopedRoutes.unassigned?.length || 0, icon: icons.unassigned, routes: (scopedRoutes.unassigned || []).slice(0, 5).map((r: any) => ({id: r.id, destination: r.destination_address, driver_name: r.driver_name}))},
      {status: 'in-progress', label: getLabel('in-progress'), count: scopedRoutes['in-progress']?.length || 0, icon: icons['in-progress'], routes: (scopedRoutes['in-progress'] || []).slice(0, 5).map((r: any) => ({id: r.id, destination: r.destination_address, driver_name: r.driver_name}))},
      {status: 'pending', label: getLabel('pending'), count: scopedRoutes.pending?.length || 0, icon: icons.pending, routes: (scopedRoutes.pending || []).slice(0, 5).map((r: any) => ({id: r.id, destination: r.destination_address, driver_name: r.driver_name}))},
      {status: 'completed', label: getLabel('completed'), count: scopedRoutes.completed?.length || 0, icon: icons.completed, routes: (scopedRoutes.completed || []).slice(0, 5).map((r: any) => ({id: r.id, destination: r.destination_address, driver_name: r.driver_name}))},
      {status: 'issues', label: getLabel('issues'), count: scopedRoutes.issues?.length || 0, icon: icons.issues, routes: (scopedRoutes.issues || []).slice(0, 5).map((r: any) => ({id: r.id, destination: r.destination_address, driver_name: r.driver_name}))},
    ]
  }, [scopedRoutes, locale])

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
          <div>
            <p className={styles.eyebrow}>{c.operations.toUpperCase()}</p>
            <h1>{c.title}</h1>
            <p>{c.subtitle}</p>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.secondaryButton} href="/contacts"><Users size={18}/>{t.contacts}</Link>
            <button className={styles.secondaryButton} type="button" data-on={managing ? 'true' : 'false'} onClick={() => { setManaging(on => !on); setPane('list') }}>
              <RouteIcon size={18}/>{c.manage}
            </button>
            <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button>
          </div>
        </header>

        {message && <div className={message.includes('successfully') || message.includes('publicad') ? styles.successMessage : styles.message} role="status">{message}</div>}

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

        <VehicleSelector
          drivers={drivers}
          selectedDriverId={selectedDriverId}
          onDriverSelect={setSelectedDriverId}
          driverStats={driverStats}
          locale={locale}
        />

        <div className={board.mobileToggle}>
          <button type="button" data-on={pane === 'list' ? 'true' : 'false'} onClick={() => setPane('list')}>{locale==='es'?'Lista':locale==='fr'?'Liste':'List'}</button>
          <button type="button" data-on={pane === 'map' ? 'true' : 'false'} onClick={() => setPane('map')}>{locale==='es'?'Mapa':locale==='fr'?'Carte':'Map'}</button>
        </div>

        <DispatchLayout
          sidebar={<StatusSidebar sections={statusSections} selectedStatus={selectedStatus} onStatusSelect={setSelectedStatus} locale={locale} />}
          center={
            <div>
              <DailyProgress
                total={dailyProgress.total}
                completed={dailyProgress.completed}
                inProgress={dailyProgress.inProgress}
                pending={dailyProgress.pending}
                issues={dailyProgress.issues}
                locale={locale}
              />
              <RouteSearch value={searchQuery} onChange={setSearchQuery} locale={locale} />
              {managing && <p className={board.manageHint}>{locale==='es'?'Sube, baja o cancela las rutas aqui. No se abre otra pagina.':locale==='fr'?'Montez, descendez ou annulez ici. Aucune autre page.':'Move or cancel routes here. Stay on this page.'}</p>}
              {loading ? (
                <section className={styles.routeGrid} aria-label={c.loadError}>
                  {[0, 1, 2].map(item => <div className={styles.skeletonCard} key={item}><i/><b/><span/></div>)}
                </section>
              ) : routesForSelectedStatus.length > 0 ? (
                <>
                  <section className={styles.routeSection}>
                    <div className={styles.sectionHeading}>
                      <h2>{statusSections.find((s: any) => s.status === selectedStatus)?.label}</h2>
                      <span>{routesForSelectedStatus.length}</span>
                    </div>
                    <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                      <RouteRows
                        items={routesForSelectedStatus}
                        locale={locale}
                        c={c}
                        driverIndex={driverIndex}
                        onCancel={cancelRoute}
                        onMove={moveRoute}
                        onTogglePause={toggleRoutePause}
                        busyRouteId={busyRouteId}
                        managing={managing}
                      />
                    </div>
                  </section>
                  {selectedRoute && (
                    <RouteDetailsPanel
                      route={selectedRoute}
                      onPause={managing ? (id: string) => toggleRoutePause(selectedRoute) : undefined}
                      onCancel={managing ? (id: string) => cancelRoute(selectedRoute) : undefined}
                      managing={managing}
                      locale={locale}
                      driverName={selectedRouteDis || undefined}
                    />
                  )}
                </>

              ) : (
                <section className={styles.emptyState}>
                  <div><RouteIcon size={28}/></div>
                  <h2>{locale==='es'?'Sin rutas':locale==='fr'?'Aucun itinéraire':'No routes'}</h2>
                  <p>{locale==='es'?`No hay rutas en estado "${statusSections.find((s: any) => s.status === selectedStatus)?.label}" para este día.`:locale==='fr'?`Pas de routes avec le statut "${statusSections.find((s: any) => s.status === selectedStatus)?.label}" pour ce jour.`:`No routes with status "${statusSections.find((s: any) => s.status === selectedStatus)?.label}" for this day.`}</p>
                  {selectedStatus === 'unassigned' && <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button>}
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
