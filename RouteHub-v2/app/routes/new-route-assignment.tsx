'use client'

import {ChevronRight, SlidersHorizontal} from 'lucide-react'
import {useEffect, useState} from 'react'
import styles from './routes.module.css'
import ui from './new-route-ui.module.css'
import {driverDetails} from './routes-model'

// Driver / Schedule / More details (PO, priority) / Driver note, grouped in
// their own grey surface so "who and when" reads apart from "where"
// instead of every field competing in one long column. Cancel/Assign live
// in the left column below Route details instead (see new-route-panel.tsx)
// so they always sit at the true bottom of the form. More details is always
// expanded here - the panel comfortably fits this screen, so hiding it
// behind a toggle only added a click with nothing gained.
export default function NewRouteAssignment(p: any) {
  const {locale, c, form, setForm, defaultBranch, todayValue, drivers, insertBeforeId, setInsertBeforeId, priorityRoutes} = p
  const [driverMenuOpen, setDriverMenuOpen] = useState(false)
  const [dateMode, setDateMode] = useState<'today' | 'custom'>(form.date === todayValue ? 'today' : 'custom')
  // form.date can change from outside this component (tapping a different
  // day in the calendar strip above while the form is open) - keep the
  // Today/Choose date toggle in sync with it instead of freezing at
  // whichever mode was true when this component first mounted.
  useEffect(() => {
    setDateMode(form.date === todayValue ? 'today' : 'custom')
  }, [form.date, todayValue])
  // A new route always starts as "as soon as possible" - form.time defaults
  // to the current clock time (see localSchedule()), which isn't a real
  // scheduling choice, just the moment the form happened to open. Clear it
  // once on mount so the dropdown doesn't open already looking scheduled.
  const [timeMode, setTimeMode] = useState<'asap' | 'specific'>('asap')
  useEffect(() => {
    if (form.time) setForm((current: any) => ({...current, time: ''}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const driverList = (drivers || []) as any[]
  const selectedDriver = driverList.find(driver => driver.user_id === form.driver_id)
  const selectedDetails = selectedDriver ? driverDetails(selectedDriver, selectedDriver.role === 'driver' ? c.teamDriver : c.driver) : null
  const selectedName = selectedDetails?.name || c.chooseDriver
  const initials = selectedName.split(/\s+/).map((part: string) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'TD'
  const isPrimary = selectedDriver && selectedDriver.user_id === defaultBranch?.primary_driver_id

  const chooseDriver = (userId: string) => {
    setForm((current: any) => ({...current, driver_id: userId}))
    setDriverMenuOpen(false)
  }

  const setToday = () => {
    setDateMode('today')
    setForm((current: any) => ({...current, date: todayValue}))
  }
  const setCustomDate = () => {
    setDateMode('custom')
    if (form.date === todayValue) {
      const tomorrow = new Date(`${todayValue}T12:00:00`)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
      const day = String(tomorrow.getDate()).padStart(2, '0')
      setForm((current: any) => ({...current, date: `${tomorrow.getFullYear()}-${month}-${day}`}))
    }
  }

  return (
    <div className={ui.assignmentPanel}>
      <div>
        <h3>{c.driver}</h3>
        <button type="button" className={ui.driverCard} onClick={() => setDriverMenuOpen(value => !value)} aria-expanded={driverMenuOpen}>
          <span className={ui.avatar}>{initials}</span>
          <span className={ui.driverInfo}>
            <strong>{selectedName}</strong>
            <span>{isPrimary ? (locale==='es'?'Conductor principal':locale==='fr'?'Conducteur principal':'Primary driver') : selectedDriver ? (selectedDriver.role==='driver'?c.teamDriver:c.driver) : (locale==='es'?'Sin asignar':locale==='fr'?'Non assigné':'Not assigned')}</span>
          </span>
          <ChevronRight size={16}/>
        </button>
        {driverMenuOpen && <div className={ui.driverMenu}>
          {driverList.map((driver, index) => {
            const fallback = `${c.driver} ${index + 1}`
            const details = driverDetails(driver, driver.role === 'driver' ? c.teamDriver : fallback)
            const primary = driver.user_id === defaultBranch?.primary_driver_id
            return (
              <button key={driver.user_id} type="button" className={driver.user_id === form.driver_id ? ui.driverMenuItemActive : ui.driverMenuItem} onClick={() => chooseDriver(driver.user_id)}>
                {details.name || fallback}{primary ? ' — Primary' : ''}
              </button>
            )
          })}
        </div>}
        {form.driver_id && form.date === todayValue && priorityRoutes?.length > 0 && <label className={`${ui.field} ${ui.fieldSpaced}`}>
          <select value={insertBeforeId} onChange={event => setInsertBeforeId(event.target.value)}>
            <option value="">{locale==='es' ? 'Agregar al final' : 'Add to end'}</option>
            {priorityRoutes.map((route: any) => <option key={route.id} value={route.id}>{locale==='es'?'Antes de':'Before'} {route.destination_name || route.destination_address}</option>)}
          </select>
        </label>}
      </div>

      <div>
        <h3>{locale==='es'?'Horario':locale==='fr'?'Horaire':'Schedule'}</h3>
        <div className={ui.scheduleToggle}>
          <button type="button" className={dateMode==='today' ? ui.scheduleToggleActive : ''} onClick={setToday}>{locale==='es'?'Hoy':locale==='fr'?'Aujourd’hui':'Today'}</button>
          <button type="button" className={dateMode==='custom' ? ui.scheduleToggleActive : ''} onClick={setCustomDate}>{locale==='es'?'Elegir fecha':locale==='fr'?'Choisir une date':'Choose date'}</button>
        </div>
        {dateMode==='custom' && <label className={`${ui.field} ${ui.fieldSpaced}`}><input type="date" value={form.date} onChange={event => setForm((current: any) => ({...current, date: event.target.value}))}/></label>}

        <label className={`${ui.field} ${ui.fieldSpaced}`}>
          <select value={timeMode} onChange={event => { const mode = event.target.value as 'asap'|'specific'; setTimeMode(mode); if (mode === 'asap') setForm((current: any) => ({...current, time: ''})) }}>
            <option value="asap">{locale==='es'?'Lo antes posible':locale==='fr'?'Dès que possible':'As soon as possible'}</option>
            <option value="specific">{locale==='es'?'Elegir hora':locale==='fr'?'Choisir une heure':'Choose a time'}</option>
          </select>
        </label>
        {timeMode==='specific' && <label className={`${ui.field} ${ui.fieldSpaced}`}><input type="time" value={form.time} onChange={event => setForm((current: any) => ({...current, time: event.target.value}))}/></label>}
      </div>

      <div>
        <h3><SlidersHorizontal size={15}/>{locale==='es' ? 'Más detalles' : locale==='fr' ? 'Plus de détails' : 'More details'}</h3>
        <div id="route-more-details" className={ui.moreDetailsPanel}>
          {form.type!=='pickup'&&form.type!=='delivery'&&<label className={`${ui.field} ${ui.fieldSpaced}`}><span>{c.po} <em className={ui.optionalLabel}>{c.optional}</em></span><input value={form.order_number} onChange={event => setForm((current: any) => ({...current, order_number: event.target.value}))}/></label>}
          <label className={`${ui.field} ${ui.fieldSpaced}`}>
            <span>{locale==='es'?'Prioridad':locale==='fr'?'Priorité':'Priority'}</span>
            <select value={form.priority} onChange={event => setForm((current: any) => ({...current, priority: event.target.value}))}>
              <option value="normal">{c.normal}</option>
              <option value="priority">{c.priorityName}</option>
              <option value="urgent">{c.urgent}</option>
            </select>
          </label>
          <label className={`${ui.field} ${ui.fieldSpaced}`}>
            <span>{locale==='es'?'Nota para el conductor':locale==='fr'?'Note pour le conducteur':'Driver note'} <em className={ui.optionalLabel}>{c.optional}</em></span>
            <textarea value={form.notes} placeholder={locale==='es'?'Código de acceso, estacionamiento o instrucciones…':locale==='fr'?'Code d’accès, stationnement ou instructions…':'Gate code, parking or instructions…'} onChange={event => setForm((current: any) => ({...current, notes: event.target.value}))}/>
          </label>
        </div>
      </div>
    </div>
  )
}
