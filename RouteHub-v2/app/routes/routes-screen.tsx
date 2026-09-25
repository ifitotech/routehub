'use client'

export const dynamic = 'force-dynamic'

import {useCallback, useEffect, useMemo, useState} from 'react'
import {createPortal} from 'react-dom'
import Link from 'next/link'
import {AlertTriangle, ArrowRight, ArrowUpDown, ChevronDown, Map, Plus, Route as RouteIcon, Users, X} from 'lucide-react'
import RouteRows from './routes-rows'
import ManagerShell from '../manager/manager-shell'
import TemporaryRouteAssignments from '../temporary-route-assignments'
import NewRouteResponsive from './new-route-responsive'
import RouteDetailView from './route-detail-view'
import RoutesBoard from './routes-board'
import DispatchCalendar from './dispatch-calendar'
import UnassignedPanel from './unassigned-panel'
import TruckBar from './truck-bar'
import DispatchLayout from './dispatch-layout'
import DriverDropdown from './driver-dropdown'
import DailyProgress from './daily-progress'
import RouteSearch from './route-search'
import styles from './routes.module.css'
import board from './routes-board.module.css'
import './routes-dispatch.css'
import {useRoutesWorkspace} from './routes-workspace'
import {routeDateValue, type RouteRecord} from './routes-model'
import {useRouteDrag, type RouteDropTarget} from './use-route-drag'

// Same palette family as UnassignedPanel's own drop-hint illustration
// (unassigned-panel.tsx's dropBoxes SVG) and TruckBar's van, so the empty
// board reads as the same illustration set rather than a one-off graphic.
function EmptyRoutesIllustration() {
  return (
    <svg className={styles.emptyIllustration} viewBox="0 0 300 168" aria-hidden="true">
      <ellipse cx="150" cy="152" rx="118" ry="8" fill="rgba(0,0,0,.25)" />
      <rect x="14" y="66" width="30" height="70" rx="3" fill="#16304f" opacity=".55" />
      <rect x="252" y="50" width="34" height="86" rx="3" fill="#16304f" opacity=".55" />
      <path d="M52 20q10-10 20 0q8-8 16 2" stroke="#2f4d78" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".5" />
      <path d="M214 12q10-9 19 0q8-7 15 2" stroke="#2f4d78" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".5" />

      {/* Folded map */}
      <g transform="translate(80 34)">
        <path d="M40 0 80 16 40 32 0 16z" fill="#2f5282" />
        <path d="M0 16 40 32V78L0 62z" fill="#17325a" />
        <path d="M40 32 80 16V62L40 78z" fill="#20416c" />
        <path d="M13 27 40 38l0 22-27-11z" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5" />
        <path d="M67 27 40 38l0 22 27-11z" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.5" />
        <path d="M17 46q11 10 23 2q10-8 22 1" stroke="#8fb4ff" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" fill="none" />
        <circle cx="17" cy="46" r="5" fill="#4592ff" stroke="#0b1c33" strokeWidth="1.5" />
        <circle cx="62" cy="49" r="5" fill="#4592ff" stroke="#0b1c33" strokeWidth="1.5" />
      </g>

      {/* Clipboard */}
      <g transform="translate(180 40)">
        <rect x="0" y="6" width="48" height="64" rx="6" fill="#1d3a60" />
        <rect x="16" y="0" width="16" height="10" rx="3" fill="#4592ff" />
        <rect x="8" y="20" width="32" height="4" rx="2" fill="#5b7ba6" />
        <rect x="8" y="32" width="32" height="4" rx="2" fill="#5b7ba6" />
        <rect x="8" y="44" width="22" height="4" rx="2" fill="#5b7ba6" />
        <circle cx="10" cy="21.5" r="0" fill="none" />
        <path d="M9 43.5 12 46.5 18 40.5" stroke="#25d885" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(-1 -12)" />
      </g>

      {/* Van */}
      <g transform="translate(196 96)">
        <path d="M2 30V22c0-2 1-4 2.6-5.2L13 10c1.4-1.3 3.1-2 5-2H70c2.4 0 4.2 1.9 4.2 4.2V30z" fill="#2a4a74" />
        <path d="M2 25h72v6H2z" fill="#16304f" />
        <path d="M8.5 17.5 16.5 10.7c.6-.5 1.3-.8 2-.8H24v8z" fill="#0b1c33" />
        <rect x="27" y="9" width="10" height="8" rx="1" fill="#0b1c33" />
        <circle cx="19" cy="30.5" r="5" fill="#0b1c33" />
        <circle cx="19" cy="30.5" r="2" fill="#7d93b8" />
        <circle cx="63" cy="30.5" r="5" fill="#0b1c33" />
        <circle cx="63" cy="30.5" r="2" fill="#7d93b8" />
      </g>
    </svg>
  )
}

export default function Routes() {
  const w = useRoutesWorkspace()
  const [pane, setPane] = useState<'list' | 'map'>('list')
  // Named mapDetailsOpen (not detailsOpen) - that name is already taken by
  // the Add Route form's own "More details" toggle, an unrelated piece of
  // state from useRoutesWorkspace() destructured further down.
  const [mapDetailsOpen, setMapDetailsOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => w.todayValue)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewingRouteId, setViewingRouteId] = useState<string | null>(null)
  // "View unassigned" in the empty state has nothing to link to (Unassigned
  // is a bar above, not its own route) - bumping this tells the panel to
  // open its own flyout instead.
  const [viewUnassignedSignal, setViewUnassignedSignal] = useState(0)
  const [sortBy, setSortBy] = useState<'stop' | 'time' | 'status'>('stop')
  // Dragging a route only stages where it would land (driver + position) -
  // nothing is written to the database or pushed to a driver's phone until
  // "Done" (the same Edit routes toggle) commits every staged move at once.
  // Without this, a driver would get a notification for every intermediate
  // drop while the manager was still deciding where a route actually goes.
  type PendingMove = {targetDriverId: string | null; beforeRouteId: string | null}
  const [pendingMoves, setPendingMoves] = useState(() => new globalThis.Map<string, PendingMove>())
  const [committingMoves, setCommittingMoves] = useState(false)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('manage') === '1') setManaging(true)
      if (params.get('pane') === 'map') setPane('map')
    } catch {}
  }, [])

  const {c, locale, t, defaultBranch, open, saving, justCreated, previewOpen, form, setForm, selectedContact, originMode, detailsOpen, setDetailsOpen, todayValue, oc, branches, contacts, drivers, save, pendingLocation, setPendingLocation, useConfirmedDestination, updateDestination, destinationSuggestions, selectDestinationContact, selectExternalDestination, searchContext, selectedDestinationLocation, setSelectedDestinationLocation, insertBeforeId, setInsertBeforeId, priorityRoutes, saveContactOpen, setSaveContactOpen, contactSaveMessage, setContactSaveMessage, newContactName, setNewContactName, savingContact, saveDestinationAsContact, planningMapRoutes, setOpen, setPreviewOpen, setOriginSource, selectDriver, openBuilder, message, cancelRoute, moveRoute, toggleRoutePause, assignRouteToDriver, unassignRoute, moveRouteToPosition, busyRouteId, driverIndex, loading, editingRouteId, setEditingRouteId} = w

  // Shared by the Assigned list's row menu (manage mode only) and the
  // Unassigned panel (always) - a route sitting unassigned or waiting for a
  // driver still needs a way to fix a wrong address/time/PO without
  // cancelling and re-creating it from scratch.
  const openEditForm = (route: RouteRecord) => {
    const scheduled = route.scheduled_at ? new Date(route.scheduled_at) : null
    const time = scheduled ? scheduled.toISOString().slice(11, 16) : ''
    setForm({
      type: (route.mission_type === 'pickup' || route.mission_type === 'delivery' || route.mission_type === 'transfer' || route.mission_type === 'return' ? route.mission_type : 'delivery') as any,
      origin: route.origin_name || route.origin_address || '',
      destination: route.destination_name || route.destination_address || '',
      destination_label: route.destination_name || route.destination_address || '',
      destination_phone: route.destination_phone || '',
      stop_contact_name: route.destination_contact_name || '',
      contact_id: '',
      priority: (route.priority === 'priority' || route.priority === 'urgent' ? route.priority : 'normal') as any,
      order_number: route.order_number || '',
      notes: route.notes || '',
      date: route.route_date || '',
      time,
      driver_id: route.driver_id || '',
      insert_before_id: '',
    })
    setEditingRouteId(route.id)
    setOpen(true)
  }

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
  const unassignedRoutes = useMemo(() => scopedRoutes.unassigned || [], [scopedRoutes])

  const matchesSearch = useCallback((r: any) => {
    if (!searchQuery.trim()) return true
    const destination = (r.destination_address || r.destination_name || '').toLowerCase()
    return destination.includes(searchQuery.toLowerCase())
  }, [searchQuery])

  // Center queue is today's active work only now - issues and completed
  // routes have nothing left to do here, so they moved to the sidebar
  // panel below Unassigned instead of sitting mixed into this list.
  const assignedRoutes = useMemo(() => {
    let combined = [
      ...(scopedRoutes['in-progress'] || []),
      ...(scopedRoutes.pending || []),
    ]

    if (searchQuery.trim()) combined = combined.filter(matchesSearch)

    return combined
  }, [scopedRoutes, searchQuery, matchesSearch])

  // Dragging a card to Unassigned frees its driver; dragging one from
  // Unassigned onto an assigned card takes that card's driver and drops in
  // right where it landed - "the spot the delivery would actually happen"
  // rather than always appending to the end of that driver's queue.
  const dragRoutesById = useMemo(() => {
    const map = new globalThis.Map<string, RouteRecord>()
    for (const item of unassignedRoutes) map.set(item.id, item)
    for (const item of assignedRoutes) map.set(item.id, item)
    return map
  }, [unassignedRoutes, assignedRoutes])
  // Applies pendingMoves on top of the real unassigned/assigned lists so the
  // board reflects every staged drag immediately, without any of it having
  // reached the database yet.
  const {unassignedRoutes: stagedUnassigned, assignedRoutes: stagedAssigned} = useMemo(() => {
    if (!pendingMoves.size) return {unassignedRoutes, assignedRoutes}
    const stagedIds = new Set(pendingMoves.keys())
    const nextUnassigned = unassignedRoutes.filter(route => !stagedIds.has(route.id))
    const nextAssigned = assignedRoutes.filter(route => !stagedIds.has(route.id))
    for (const [routeId, move] of pendingMoves) {
      const original = dragRoutesById.get(routeId)
      if (!original) continue
      // position drops out here - the row's own index in this staged list
      // is the visible number, not the stale slot it held in its old queue.
      const staged = {...original, driver_id: move.targetDriverId, position: null}
      if (move.targetDriverId === null) {
        nextUnassigned.push(staged)
      } else {
        const beforeIndex = move.beforeRouteId ? nextAssigned.findIndex(route => route.id === move.beforeRouteId) : -1
        if (beforeIndex < 0) nextAssigned.push(staged)
        else nextAssigned.splice(beforeIndex, 0, staged)
      }
    }
    return {unassignedRoutes: nextUnassigned, assignedRoutes: nextAssigned}
  }, [unassignedRoutes, assignedRoutes, pendingMoves, dragRoutesById])
  // Display-only ordering. Edit routes always works on stop order, since
  // that's the order drag/move actually change.
  const effectiveSort = managing ? 'stop' : sortBy
  const visibleAssigned = useMemo(() => {
    if (effectiveSort === 'stop') return stagedAssigned
    const statusRank: Record<string, number> = {active: 0, paused: 1, issue: 2, pending: 3, published: 4, draft: 5, completed: 6, cancelled: 7}
    const timeOf = (route: RouteRecord) => {
      const value = route.scheduled_at ? new Date(route.scheduled_at).getTime() : NaN
      return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value
    }
    return stagedAssigned.slice().sort((a, b) => effectiveSort === 'time'
      ? timeOf(a) - timeOf(b)
      : (statusRank[a.status || 'pending'] ?? 9) - (statusRank[b.status || 'pending'] ?? 9) || timeOf(a) - timeOf(b))
  }, [stagedAssigned, effectiveSort])
  const handleRouteDrop = useCallback((draggedId: string, target: RouteDropTarget) => {
    const dragged = dragRoutesById.get(draggedId)
    if (!dragged) return
    const targetDriverId = target.kind === 'unassigned' ? null : dragRoutesById.get(target.routeId)?.driver_id || null
    if (target.kind === 'route' && !targetDriverId) return
    if (targetDriverId === (dragged.driver_id || null) && target.kind === 'route' && target.routeId === dragged.id) return
    // Reaching here at all means managing was already on - dragging can
    // only start once "Edit routes" is active (see canDrag/onDragStart),
    // so there's nothing to re-enable here.
    setPendingMoves(current => {
      const next = new globalThis.Map(current)
      next.set(draggedId, {targetDriverId, beforeRouteId: target.kind === 'route' ? target.routeId : null})
      return next
    })
  }, [dragRoutesById])
  const {draggingId, pointer: dragPointer, overTarget: dragOverTarget, startDrag} = useRouteDrag(handleRouteDrop)
  const draggedRoute = draggingId ? dragRoutesById.get(draggingId) : null
  const dragOverRouteId = dragOverTarget?.kind === 'route' ? dragOverTarget.routeId : null
  const dragOverUnassigned = dragOverTarget?.kind === 'unassigned'
  // Commits every staged drag at once - one real update and one driver
  // notification per affected route, for its final position only, not one
  // per intermediate drop while the manager was still rearranging things.
  const commitPendingMoves = useCallback(async () => {
    if (!pendingMoves.size) return
    setCommittingMoves(true)
    const moves = Array.from(pendingMoves.entries())
    setPendingMoves(new globalThis.Map())
    try {
      for (const [routeId, move] of moves) {
        const original = dragRoutesById.get(routeId)
        if (!original) continue
        if (move.targetDriverId === null) await unassignRoute(original)
        else await moveRouteToPosition(original, move.targetDriverId, move.beforeRouteId)
      }
    } finally {
      setCommittingMoves(false)
    }
  }, [pendingMoves, dragRoutesById, unassignRoute, moveRouteToPosition])

  // Live in the sidebar below Unassigned instead - see UnassignedPanel.
  const issueRoutes = useMemo(() => (scopedRoutes.issues || []).filter(matchesSearch), [scopedRoutes, matchesSearch])
  const completedRoutes = useMemo(() => (scopedRoutes.completed || []).filter(matchesSearch), [scopedRoutes, matchesSearch])

  // The search box used to just quietly filter whichever day was already
  // selected, which made typing a destination feel like it did nothing if
  // that route lived on a different day. A dropdown of matches across the
  // whole history makes the search actually findable - picking one jumps
  // the board straight to that route's day.
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []
    return w.routes
      .filter(route => route.status !== 'cancelled')
      .filter(route => (route.destination_address || route.destination_name || '').toLowerCase().includes(query))
      .sort((a, b) => routeDateValue(b).localeCompare(routeDateValue(a)) || (b.scheduled_at || '').localeCompare(a.scheduled_at || ''))
      .slice(0, 8)
  }, [w.routes, searchQuery])

  const selectSearchResult = useCallback((route: any) => {
    const date = routeDateValue(route) || todayValue
    setSelectedDriverId(null)
    setSelectedDate(date)
    setViewingRouteId(route.driver_id ? route.id : null)
    setOpen(false)
    setSearchQuery('')
  }, [todayValue, setOpen])

  const viewingRoute = viewingRouteId
    ? [...assignedRoutes, ...issueRoutes, ...completedRoutes].find((r: any) => r.id === viewingRouteId)
    : null

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
      mission_type: route.mission_type,
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
      order_number: route.order_number,
      notes: route.notes,
      priority: route.priority,
      scheduled_at: route.scheduled_at,
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
            <RouteSearch value={searchQuery} onChange={setSearchQuery} locale={locale} c={c} results={searchResults} driverIndex={driverIndex} onSelectResult={selectSearchResult} />
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
            <button className={styles.secondaryButton} type="button" data-on={managing ? 'true' : 'false'} disabled={committingMoves} style={{justifyContent: 'center', minWidth: '13ch'}} onClick={async () => {
              if (managing && pendingMoves.size) await commitPendingMoves()
              setManaging(on => !on)
              setPane('list')
            }}>
              <RouteIcon size={18}/>{committingMoves ? (locale==='es'?'Guardando…':locale==='fr'?'Enregistrement…':'Saving…') : managing ? (locale==='es'?`Listo${pendingMoves.size ? ` (${pendingMoves.size})` : ''}`:locale==='fr'?`Terminé${pendingMoves.size ? ` (${pendingMoves.size})` : ''}`:`Done${pendingMoves.size ? ` (${pendingMoves.size})` : ''}`) : c.manage}
            </button>
            {open
              ? <button className={styles.secondaryButton} type="button" onClick={() => setOpen(false)}><X size={18}/>{locale==='es'?'Cancelar':locale==='fr'?'Annuler':'Cancel'}</button>
              : <button className={styles.primaryButton} type="button" onClick={() => openBuilder(selectedDate)}><Plus size={18}/>{c.add}</button>}
          </div>
        </header>

        {/* Self-contained: queries the signed-in user's own temporary
            assignments and renders nothing when there are none, so it's
            safe to show unconditionally here - a branch/operations manager
            who is also covering a route sees it the same way Sales/Counter
            already do, without leaving their normal dashboard. */}
        <TemporaryRouteAssignments/>

        {message && <div className={message.includes('successfully') || message.includes('publicad') ? styles.successMessage : styles.message} role="status" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14}}><span>{message}</span>{!(message.includes('successfully') || message.includes('publicad')) && <button type="button" onClick={() => window.location.reload()} style={{flex:'none',padding:'7px 11px',border:'1px solid currentColor',borderRadius:999,background:'transparent',color:'inherit',font:'inherit',fontSize:12,fontWeight:800,cursor:'pointer'}}>{locale==='es'?'Reintentar':locale==='fr'?'Réessayer':'Retry'}</button>}</div>}

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
          <button type="button" className={styles.mapShortcut} onClick={() => setMapDetailsOpen(true)} aria-label={locale==='es'?'Ver mapa':locale==='fr'?'Voir la carte':'View map'}>
            <Map size={16}/>
          </button>
        </div>

        <div className={board.mobileToggle}>
          <button type="button" data-on={pane === 'list' ? 'true' : 'false'} onClick={() => setPane('list')}>{locale==='es'?'Lista':locale==='fr'?'Liste':'List'}</button>
          <button type="button" data-on={pane === 'map' ? 'true' : 'false'} onClick={() => setPane('map')}>{locale==='es'?'Mapa':locale==='fr'?'Carte':'Map'}</button>
        </div>

        <DispatchLayout
          unassignedBar={
            <UnassignedPanel
              routes={stagedUnassigned}
              drivers={drivers}
              onAssign={assignRouteToDriver}
              onEdit={openEditForm}
              onCancel={cancelRoute}
              busyRouteId={busyRouteId}
              locale={locale}
              issueRoutes={issueRoutes}
              completedRoutes={completedRoutes}
              onViewDetails={setViewingRouteId}
              onDragStart={managing ? startDrag : undefined}
              draggingRouteId={draggingId}
              dragOverZone={dragOverUnassigned}
              managing={managing}
              forceOpenSignal={viewUnassignedSignal}
            />
          }
          center={
            viewingRoute ? (
              <RouteDetailView route={viewingRoute} locale={locale} c={c} driverIndex={driverIndex} onClose={() => setViewingRouteId(null)}/>
            ) : open ? (
              <div className={styles.formViewFade}>
                <NewRouteResponsive
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
                  editingRouteId={editingRouteId}
                />
              </div>
            ) : (
              <div
                className={styles.routesQueuePane}
              >
                {managing && <p className={board.manageHint}>{pendingMoves.size ? (locale==='es'?'Cambios sin guardar. El conductor se entera al presionar Listo.':locale==='fr'?'Modifications non enregistrées. Le conducteur est informé en appuyant sur Terminé.':'Unsaved changes. The driver finds out when you press Done.') : (locale==='es'?'Sube, baja, cancela o arrastra las rutas aqui. No se abre otra pagina.':locale==='fr'?'Montez, descendez, annulez ou glissez ici. Aucune autre page.':'Move, cancel or drag routes here. Stay on this page.')}</p>}
                {loading ? (
                  <section className={styles.routeGrid} aria-label={c.loadError}>
                    {[0, 1, 2].map(item => <div className={styles.skeletonCard} key={item}><i/><b/><span/></div>)}
                  </section>
                ) : stagedAssigned.length > 0 ? (
                  <section className={`${styles.routeSection} ${styles.assignedPanel}`}>
                    <div className={styles.assignedHeader}>
                      <RouteIcon size={20} className={styles.assignedIcon}/>
                      <h2>{locale==='es'?'Rutas asignadas':locale==='fr'?'Itinéraires attribués':'Assigned Routes'}</h2>
                      <span className={styles.assignedCount}>{stagedAssigned.length}</span>
                      <label className={styles.sortControl}>
                        <ArrowUpDown size={15}/>
                        <span>{locale==='es'?'Ordenar por':locale==='fr'?'Trier par':'Sort by'}</span>
                        <span className={styles.sortSelectWrap}>
                          <select value={effectiveSort} disabled={managing} onChange={event => setSortBy(event.target.value as 'stop' | 'time' | 'status')}>
                            <option value="stop">{locale==='es'?'Orden de paradas':locale==='fr'?'Ordre des arrêts':'Stop order'}</option>
                            <option value="time">{locale==='es'?'Hora programada':locale==='fr'?'Heure prévue':'Scheduled time'}</option>
                            <option value="status">{locale==='es'?'Estado':locale==='fr'?'Statut':'Status'}</option>
                          </select>
                          <ChevronDown size={15}/>
                        </span>
                      </label>
                    </div>
                    <RouteRows
                      items={visibleAssigned}
                      locale={locale}
                      c={c}
                      driverIndex={driverIndex}
                      onCancel={cancelRoute}
                      onMove={moveRoute}
                      onTogglePause={toggleRoutePause}
                      onUnassign={unassignRoute}
                      onAssign={assignRouteToDriver}
                      drivers={drivers}
                      onViewDetails={setViewingRouteId}
                      onEdit={(route) => openEditForm(route)}
                      onSave={save}
                      busyRouteId={busyRouteId}
                      editingRouteId={editingRouteId}
                      formOpen={open}
                      managing={managing}
                      onRequestManage={() => setManaging(true)}
                      onDragStart={startDrag}
                      draggingRouteId={draggingId}
                      dragOverRouteId={dragOverRouteId}
                    />
                  </section>
                ) : (
                  <section className={styles.emptyState}>
                    <EmptyRoutesIllustration/>
                    <h2>{locale==='es'?'Sin rutas asignadas para hoy':locale==='fr'?'Aucun itinéraire attribué aujourd’hui':'No assigned routes for today'}</h2>
                    <p>{locale==='es'?'Las rutas nuevas aparecerán aquí cuando se publiquen o asignen.':locale==='fr'?'Les nouveaux itinéraires apparaîtront ici une fois publiés ou attribués.':'New routes will appear here once they are published or assigned.'}</p>
                    <p>{locale==='es'?'Crea una ruta o revisa las rutas sin asignar para empezar.':locale==='fr'?'Créez un itinéraire ou consultez les non attribués pour commencer.':'Create a route or review unassigned stops to get started.'}</p>
                    <div className={styles.emptyStateActions}>
                      <button className={styles.primaryButton} type="button" onClick={() => openBuilder(selectedDate)}><Plus size={18}/>{c.add}</button>
                      <button className={styles.secondaryButton} type="button" onClick={() => setViewUnassignedSignal(n => n + 1)}>{locale==='es'?'Ver sin asignar':locale==='fr'?'Voir non attribuées':'View unassigned'}</button>
                    </div>
                  </section>
                )}
              </div>
            )
          }
          map={<RoutesBoard routes={open ? (planningMapRoutes || []) : mapRoutes} locale={locale} c={c} driverIndex={driverIndex} detailsOpen={mapDetailsOpen} setDetailsOpen={setMapDetailsOpen} />}
          truckBar={<TruckBar locale={locale} />}
          pane={pane}
          focus={open || Boolean(viewingRoute)}
        />
      </div>

      {draggedRoute && dragPointer && typeof document !== 'undefined' && createPortal(
        <div className={styles.dragGhost} style={{left: dragPointer.x, top: dragPointer.y}}>
          {draggedRoute.destination_name || draggedRoute.destination_address}
        </div>,
        document.body,
      )}
    </ManagerShell>
  )
}
