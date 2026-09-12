'use client'

import {useEffect, useState} from 'react'
import ui from './new-route-ui.module.css'

// Schedule / position-in-route / Driver note, grouped in their own grey
// surface. Driver itself now sits in its own row next to route type (see
// new-route-driver-picker.tsx) instead of here - that saved a whole extra
// panel section's worth of vertical space.
export default function NewRouteAssignment(p: any) {
  const {locale, c, form, setForm, todayValue, insertBeforeId, setInsertBeforeId, priorityRoutes} = p
  const [dateMode, setDateMode] = useState<'today' | 'custom'>(form.date === todayValue ? 'today' : 'custom')
  // A new route always starts as "as soon as possible" - form.time defaults
  // to the current clock time (see localSchedule()), which isn't a real
  // scheduling choice, just the moment the form happened to open. Clear it
  // once on mount so the dropdown doesn't open already looking scheduled.
  const [timeMode, setTimeMode] = useState<'asap' | 'specific'>('asap')
  useEffect(() => {
    if (form.time) setForm((current: any) => ({...current, time: ''}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        {form.driver_id && form.date === todayValue && priorityRoutes?.length > 0 && <label className={`${ui.field} ${ui.fieldSpaced}`}>
          <select value={insertBeforeId} onChange={event => setInsertBeforeId(event.target.value)}>
            <option value="">{locale==='es' ? 'Agregar al final' : 'Add to end'}</option>
            {priorityRoutes.map((route: any) => <option key={route.id} value={route.id}>{locale==='es'?'Antes de':'Before'} {route.destination_name || route.destination_address}</option>)}
          </select>
        </label>}
      </div>

      <div>
        <h3>{locale==='es'?'Nota para el conductor':locale==='fr'?'Note pour le conducteur':'Driver note'} <span className={ui.optionalLabel}>{c.optional}</span></h3>
        <textarea value={form.notes} placeholder={locale==='es'?'Código de acceso, estacionamiento o instrucciones…':locale==='fr'?'Code d’accès, stationnement ou instructions…':'Gate code, parking or instructions…'} onChange={event => setForm((current: any) => ({...current, notes: event.target.value}))}/>
      </div>
    </div>
  )
}
