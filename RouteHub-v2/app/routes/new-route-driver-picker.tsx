'use client'

import {ChevronRight} from 'lucide-react'
import {useState} from 'react'
import ui from './new-route-ui.module.css'
import {driverDetails} from './routes-model'

// Extracted so it can sit next to the (now compact) route type row instead
// of only living in the Assignment panel - keeping driver + route type in
// one row saves the vertical space a whole extra panel section used to cost.
export default function NewRouteDriverPicker(p: any) {
  const {locale, c, form, setForm, defaultBranch, drivers} = p
  const [driverMenuOpen, setDriverMenuOpen] = useState(false)

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

  return (
    <div className={ui.driverPickerWrap}>
      <span className={ui.driverPickerLabel}>{c.driver}</span>
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
    </div>
  )
}
