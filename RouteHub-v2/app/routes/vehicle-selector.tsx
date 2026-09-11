'use client'

import {driverDetails, type Driver} from './routes-model'
import styles from './vehicle-selector.module.css'

type VehicleSelectorProps = {
  drivers: Driver[]
  selectedDriverId: string | null
  onDriverSelect: (driverId: string | null) => void
  driverStats?: Record<string, {active: number; total: number}>
  locale: string
}

export default function VehicleSelector({
  drivers,
  selectedDriverId,
  onDriverSelect,
  driverStats = {},
  locale,
}: VehicleSelectorProps) {
  // With a single driver, choosing between "All" and that one driver adds no value
  if (drivers.length <= 1) return null

  const allCount = Object.values(driverStats).reduce((sum, s) => sum + s.total, 0)
  const fallback = locale === 'es' ? 'Conductor' : locale === 'fr' ? 'Conducteur' : 'Driver'

  return (
    <div className={styles.container}>
      <span className={styles.label}>
        {locale === 'es' ? 'Conductor' : locale === 'fr' ? 'Conducteur' : 'Driver'}
      </span>
      <div className={styles.pills}>
        <button
          type="button"
          className={styles.pill}
          data-active={!selectedDriverId}
          onClick={() => onDriverSelect(null)}
        >
          {locale === 'es' ? 'Todos' : locale === 'fr' ? 'Tous' : 'All'}
          <span className={styles.count}>{allCount}</span>
        </button>

        {drivers.map(driver => {
          const {name} = driverDetails(driver, fallback)
          const stat = driverStats[driver.user_id] || {active: 0, total: 0}
          const isSelected = selectedDriverId === driver.user_id

          return (
            <button
              key={driver.user_id}
              type="button"
              className={styles.pill}
              data-active={isSelected}
              onClick={() => onDriverSelect(isSelected ? null : driver.user_id)}
            >
              {name}
              <span className={styles.count}>{stat.total}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
