'use client'

export const dynamic = 'force-dynamic'

import {useEffect, useMemo, useState} from 'react'
import Link from 'next/link'
import {Plus, Route as RouteIcon, Users} from 'lucide-react'
import RouteRows from './routes-rows'
import ManagerShell from '../manager/manager-shell'
import NewRouteDialog from './new-route-dialog'
import RoutesBoard from './routes-board'
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
    <nav className={styles.dateTabs} aria-label={locale==='es'?'Filtrar rutas por día':'Filter routes by day'}>
      {(['today','tomorrow','upcoming'] as const).map(view => <button type="button" key={view} data-active={dayView === view} onClick={() => { setDayView(view); setPane('list') }}>
        {dayCopy[view]}<span>{view === 'today' ? todayRoutes.length : view === 'tomorrow' ? tomorrowRoutes.length : futureRoutes.length}</span>
      </button>)}
    </nav>
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
        <div className={styles.sectionHeading}><h2>{c.inProgressSection}</h2><span>{inProgressRoutes.length} {c.active}</span></div>
        <RouteRows items={inProgressRoutes} locale={locale} c={c} driverIndex={driverIndex} onCancel={cancelRoute} onMove={moveRoute} onTogglePause={toggleRoutePause} busyRouteId={busyRouteId} managing={managing} />
      </section>}
      {dayView === 'today' && scheduledTodayRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.todaySection}</h2><span>{scheduledTodayRoutes.length} {c.active}</span></div>
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
        <div className={styles.sectionHeading}><h2>{c.completedSection}</h2><span>{completedTodayRoutes.length} {c.active}</span></div>
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
