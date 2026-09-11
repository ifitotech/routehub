'use client'

import {useEffect, useRef, useState} from 'react'
import {ChevronDown, Truck} from 'lucide-react'
import {driverDetails, type Driver} from './routes-model'
import styles from './driver-dropdown.module.css'

type DriverDropdownProps = {
  drivers: Driver[]
  selectedDriverId: string | null
  onDriverSelect: (driverId: string | null) => void
  driverStats?: Record<string, {active: number; total: number}>
  locale: string
}

export default function DriverDropdown({
  drivers,
  selectedDriverId,
  onDriverSelect,
  driverStats = {},
  locale,
}: DriverDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  if (drivers.length === 0) return null

  // The list is everyone a route can be assigned to - driver, counter, ops,
  // manager - not only drivers. Without a readable profile they all fell back
  // to the same word, so the menu read as four identical "Driver" rows. The
  // role is the one thing always available on the record, so it names the
  // person when their profile can't.
  const roleLabel = (role?: string) => {
    const labels: Record<string, Record<string, string>> = {
      es: {driver: 'Conductor', branch_manager: 'Gerente', operations_manager: 'Operaciones', sales_representative: 'Ventas', counter_sales: 'Mostrador'},
      fr: {driver: 'Conducteur', branch_manager: 'Responsable', operations_manager: 'Opérations', sales_representative: 'Ventes', counter_sales: 'Comptoir'},
      en: {driver: 'Driver', branch_manager: 'Manager', operations_manager: 'Operations', sales_representative: 'Sales', counter_sales: 'Counter'},
    }
    const set = labels[locale] || labels.en
    return set[role || ''] || set.driver
  }
  const allLabel = locale === 'es' ? 'Todos' : locale === 'fr' ? 'Tous' : 'All'
  const selectedDriver = selectedDriverId ? drivers.find(d => d.user_id === selectedDriverId) : null
  const currentLabel = selectedDriver ? driverDetails(selectedDriver, roleLabel(selectedDriver.role)).name : allLabel
  const allCount = Object.values(driverStats).reduce((sum, s) => sum + s.total, 0)

  return (
    <div className={styles.container} ref={containerRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen(value => !value)} data-open={open} aria-expanded={open} aria-haspopup="menu">
        <Truck size={16} />
        <span>{currentLabel}</span>
        <ChevronDown size={14} className={styles.chevron} data-open={open} />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            data-active={!selectedDriverId}
            onClick={() => { onDriverSelect(null); setOpen(false) }}
          >
            <span>{allLabel}</span>
            <span className={styles.count}>{allCount}</span>
          </button>
          {drivers.map(driver => {
            const role = roleLabel(driver.role)
            const {name} = driverDetails(driver, role)
            const stat = driverStats[driver.user_id] || {active: 0, total: 0}
            return (
              <button
                key={driver.user_id}
                type="button"
                role="menuitem"
                className={styles.item}
                data-active={selectedDriverId === driver.user_id}
                onClick={() => { onDriverSelect(driver.user_id); setOpen(false) }}
              >
                <span className={styles.person}>
                  <span className={styles.personName}>{name}</span>
                  {name !== role && <span className={styles.personRole}>{role}</span>}
                </span>
                <span className={styles.count}>{stat.total}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
