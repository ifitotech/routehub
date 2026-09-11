'use client'

export const dynamic = 'force-dynamic'

import {useEffect, useMemo, useState} from 'react'
import Link from 'next/link'
import {AlertTriangle, Clock3, Map, PlayCircle, Plus, Route as RouteIcon, Truck, Users} from 'lucide-react'
import RouteRows from './routes-rows'
import ManagerShell from '../manager/manager-shell'
import NewRouteDialog from './new-route-dialog'
import RoutesBoard from './routes-board'
import DispatchCalendar from './dispatch-calendar'
import styles from './routes.module.css'
import board from './routes-board.module.css'
import './routes-dispatch.css'
import {useRoutesWorkspace} from './routes-workspace'

export default function Routes() {
  const w = useRoutesWorkspace()
  const [pane, setPane] = useState<'list' | 'map'>('list')
  const [managing, setManaging] = useState(false)
  const [dayView, setDayView] = useState<'today' | 'tomorrow' | 'upcoming'>('today')
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('manage') === '1') setManaging(true)
    } catch {}
  }, [])
  const {c, locale, t, defaultBranch, open, saving, justCreated, previewOpen, form, setForm, selectedContact, originMode, detailsOpen, setDetailsOpen, todayValue, oc, branches, contacts, drivers, save, pendingLocation, setPendingLocation, useConfirmedDestination, updateDestination, destinationSuggestions, selectDestinationContact, selectExternalDestination, searchContext, selectedDestinationLocation, setSelectedDestinationLocation, insertBeforeId, setInsertBeforeId, priorityRoutes, saveContactOpen, setSaveContactOpen, contactSaveMessage, setContactSaveMessage, newContactName, setNewContactName, savingContact, saveDestinationAsContact, planningMapRoutes, setOpen, setPreviewOpen, setOriginSource, selectDriver, openBuilder, message, scheduledTodayRoutes = [], upcomingRoutes = [], completedTodayRoutes = [], issueTodayRoutes = [], cancelRoute, moveRoute, toggleRoutePause, busyRouteId, driverIndex, loading, inProgressRoutes = []} = w
  const tomorrowValue = useMemo(() => { const date = new Date(`${todayValue}T12:00:00`); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10) }, [todayValue])
  const tomorrowRoutes = useMemo(() => upcomingRoutes.filter((route: any) => (route.route_date || String(route.scheduled_at || '').slice(0, 10)) === tomorrowValue), [tomorrowValue, upcomingRoutes])
  const futureRoutes = useMemo(() => upcomingRoutes.filter((route: any) => (route.route_date || String(route.scheduled_at || '').slice(0, 10)) > tomorrowValue), [tomorrowValue, upcomingRoutes])
  const todayRoutes = useMemo(() => [...inProgressRoutes, ...scheduledTodayRoutes, ...issueTodayRoutes, ...completedTodayRoutes], [completedTodayRoutes, inProgressRoutes, issueTodayRoutes, scheduledTodayRoutes])
  const visibleRoutes = dayView === 'today' ? todayRoutes : dayView === 'tomorrow' ? tomorrowRoutes : futureRoutes
  const routeSummary = useMemo(() => {
    const active = visibleRoutes.filter((route: any) => ['active', 'paused'].includes(route.status || '')).length
    const pending = visibleRoutes.filter((route: any) => ['draft', 'pending', 'published'].includes(route.status || '')).length
    const issues = visibleRoutes.filter((route: any) => route.status === 'issue').length
    const driversAssigned = new Set(visibleRoutes.filter((route: any) => route.driver_id).map((route: any) => route.driver_id)).size
    return {active, pending, issues, driversAssigned}
  }, [visibleRoutes])
  const dayCopy = locale === 'es' ? {today:'Hoy', tomorrow:'Mañana', upcoming:'Próximas'} : locale === 'fr' ? {today:"Aujourd’hui", tomorrow:'Demain', upcoming:'À venir'} : {today:'Today', tomorrow:'Tomorrow', upcoming:'Upcoming'}
  const mapRoutes = useMemo(() => {
    const source = visibleRoutes
    return source.map((route: any) => ({
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
  }, [visibleRoutes])
  return <ManagerShell active="routes" branchName={defaultBranch?.name} roleLabel={t.managerRole}>
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
    <section className={styles.operationSummary} aria-label={locale==='es'?'Resumen operativo':'Operations summary'}>
      <div className={styles.operationSummaryHeading}>
        <div><p>{locale==='es'?'Control operativo':locale==='fr'?'Contrôle opérationnel':'Operations control'}</p><h2>{dayCopy[dayView]}</h2></div>
        <button type="button" className={styles.mapShortcut} onClick={() => setPane('map')}><Map size={16}/>{locale==='es'?'Ver mapa':locale==='fr'?'Voir la carte':'View map'}</button>
      </div>
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard} data-tone="blue"><span><PlayCircle size={18}/></span><div><strong>{routeSummary.active}</strong><small>{locale==='es'?'En curso':locale==='fr'?'En cours':'In progress'}</small></div></div>
        <div className={styles.summaryCard} data-tone="amber"><span><Clock3 size={18}/></span><div><strong>{routeSummary.pending}</strong><small>{locale==='es'?'Pendientes':locale==='fr'?'En attente':'Pending'}</small></div></div>
        <div className={styles.summaryCard} data-tone="red"><span><AlertTriangle size={18}/></span><div><strong>{routeSummary.issues}</strong><small>{locale==='es'?'Incidencias':locale==='fr'?'Incidents':'Issues'}</small></div></div>
        <div className={styles.summaryCard} data-tone="slate"><span><Truck size={18}/></span><div><strong>{routeSummary.driversAssigned}</strong><small>{locale==='es'?'Conductores':locale==='fr'?'Conducteurs':'Drivers'}</small></div></div>
      </div>
    </section>
    <DispatchCalendar
      selectedDate={todayValue}
      onDateChange={(date) => {
        if (date === todayValue) setDayView('today')
        else if (date === tomorrowValue) setDayView('tomorrow')
        else setDayView('upcoming')
        setPane('list')
      }}
      locale={locale}
      routeCounts={{
        [todayValue]: todayRoutes.length,
        [tomorrowValue]: tomorrowRoutes.length,
        ...futureRoutes.reduce((acc: Record<string, number>, route: any) => {
          const key = route.route_date || String(route.scheduled_at || '').slice(0, 10)
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {}),
      }}
    />
    <div className={board.mobileToggle}>
      <button type="button" data-on={pane === 'list' ? 'true' : 'false'} onClick={() => setPane('list')}>{locale==='es'?'Lista':locale==='fr'?'Liste':'List'}</button>
      <button type="button" data-on={pane === 'map' ? 'true' : 'false'} onClick={() => setPane('map')}>{locale==='es'?'Mapa':locale==='fr'?'Carte':'Map'}</button>
    </div>
    <div className={board.workspace}>
      <div className={`${board.listPane} ${pane === 'map' ? board.listHidden : ''}`}>
    {managing && <p className={board.manageHint}>{locale==='es'?'Sube, baja o cancela las rutas aqui. No se abre otra pagina.':locale==='fr'?'Montez, descendez ou annulez ici. Aucune autre page.':'Move or cancel routes here. Stay on this page.'}</p>}
    {loading ? <section className={styles.routeGrid} aria-label={c.loadError}>
      {[0, 1, 2].map(item => <div className={styles.skeletonCard} key={item}><i/><b/><span/></div>)}
    </section> : <>
      {dayView === 'today' && inProgressRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.inProgressSection}</h2><span>{inProgressRoutes.length}</span></div>
        <RouteRows items={inProgressRoutes} locale={locale} c={c} driverIndex={driverIndex} onCancel={cancelRoute} onMove={moveRoute} onTogglePause={toggleRoutePause} busyRouteId={busyRouteId} managing={managing} />
      </section>}
      {dayView === 'today' && scheduledTodayRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.todaySection}</h2><span>{scheduledTodayRoutes.length}</span></div>
        <RouteRows items={scheduledTodayRoutes} locale={locale} c={c} driverIndex={driverIndex} onCancel={cancelRoute} onMove={moveRoute} onTogglePause={toggleRoutePause} busyRouteId={busyRouteId} managing={managing} />
      </section>}
      {!loading && !visibleRoutes.length && <section className={styles.emptyState}><div><RouteIcon size={28}/></div><h2>{dayView === 'today' ? c.empty : locale==='es' ? 'No hay rutas para este día' : locale==='fr' ? 'Aucun itinéraire pour ce jour' : 'No routes for this day'}</h2><p>{dayView === 'today' ? c.emptyHelp : locale==='es' ? 'Cambia de pestaña para revisar otro período.' : locale==='fr' ? 'Changez d’onglet pour consulter une autre période.' : 'Choose another tab to review a different period.'}</p>{dayView === 'today' && <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button>}</section>}
      {dayView === 'tomorrow' && tomorrowRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{dayCopy.tomorrow}</h2><span>{tomorrowRoutes.length}</span></div>
        <RouteRows items={tomorrowRoutes} locale={locale} c={c} driverIndex={driverIndex} onCancel={cancelRoute} onMove={moveRoute} onTogglePause={toggleRoutePause} busyRouteId={busyRouteId} managing={managing} />
      </section>}
      {dayView === 'upcoming' && futureRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{dayCopy.upcoming}</h2><span>{futureRoutes.length}</span></div>
        <RouteRows items={futureRoutes} locale={locale} c={c} driverIndex={driverIndex} onCancel={cancelRoute} onMove={moveRoute} onTogglePause={toggleRoutePause} busyRouteId={busyRouteId} managing={managing} />
      </section>}
      {dayView === 'today' && completedTodayRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.completedSection}</h2><span>{completedTodayRoutes.length}</span></div>
        <RouteRows items={completedTodayRoutes} locale={locale} c={c} driverIndex={driverIndex} onCancel={cancelRoute} onMove={moveRoute} onTogglePause={toggleRoutePause} busyRouteId={busyRouteId} managing={managing} />
      </section>}
      {dayView === 'today' && issueTodayRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.issue}</h2><span>{issueTodayRoutes.length}</span></div>
        <RouteRows items={issueTodayRoutes} locale={locale} c={c} driverIndex={driverIndex} onCancel={cancelRoute} onMove={moveRoute} onTogglePause={toggleRoutePause} busyRouteId={busyRouteId} managing={managing} />
      </section>}
    </>}
      </div>
      <div className={pane === 'list' ? board.mapHidden : undefined}>
        <RoutesBoard routes={mapRoutes} locale={locale} />
      </div>
    </div>
    </div>
    {open && <NewRouteDialog open={open} saving={saving} setOpen={setOpen} justCreated={justCreated} locale={locale} c={c} openBuilder={openBuilder} previewOpen={previewOpen} setPreviewOpen={setPreviewOpen} form={form} setForm={setForm} selectedContact={selectedContact} originMode={originMode} setOriginSource={setOriginSource} selectDriver={selectDriver} oc={oc} branches={branches} contacts={contacts} defaultBranch={defaultBranch} detailsOpen={detailsOpen} setDetailsOpen={setDetailsOpen} todayValue={todayValue} drivers={drivers} save={save} pendingLocation={pendingLocation} setPendingLocation={setPendingLocation} useConfirmedDestination={useConfirmedDestination} updateDestination={updateDestination} destinationSuggestions={destinationSuggestions} selectDestinationContact={selectDestinationContact} selectExternalDestination={selectExternalDestination} searchContext={searchContext} selectedDestinationLocation={selectedDestinationLocation} setSelectedDestinationLocation={setSelectedDestinationLocation} insertBeforeId={insertBeforeId} setInsertBeforeId={setInsertBeforeId} priorityRoutes={priorityRoutes} saveContactOpen={saveContactOpen} setSaveContactOpen={setSaveContactOpen} contactSaveMessage={contactSaveMessage} setContactSaveMessage={setContactSaveMessage} newContactName={newContactName} setNewContactName={setNewContactName} savingContact={savingContact} saveDestinationAsContact={saveDestinationAsContact} planningMapRoutes={planningMapRoutes} />}
    </ManagerShell>
}
