'use client'

import {ChevronDown, MapPin, Zap} from 'lucide-react'
import styles from './vehicle-selector.module.css'

type Driver = {
  user_id: string
  name?: string
  email?: string
}

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
  const selectedDriver = selectedDriverId ? drivers.find(d => d.user_id === selectedDriverId) : null
  const stats = selectedDriverId ? driverStats[selectedDriverId] : null

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>{locale === 'es' ? 'Conductor' : locale === 'fr' ? 'Conducteur' : 'Driver'}</h3>
      </div>

      <button
        className={styles.selectorButton}
        onClick={() => onDriverSelect(null)}
        data-selected={!selectedDriverId}
      >
        <div className={styles.driverInfo}>
          <div className={styles.driverName}>
            {locale === 'es' ? 'Todos' : locale === 'fr' ? 'Tous' : 'All'}
          </div>
          <div className={styles.driverStats}>
            {Object.values(driverStats).reduce((sum, s) => sum + s.total, 0)} rutas
          </div>
        </div>
        <ChevronDown size={18} />
      </button>

      <div className={styles.driversList}>
        {drivers.map(driver => {
          const driverStat = driverStats[driver.user_id] || {active: 0, total: 0}
          const isSelected = selectedDriverId === driver.user_id

          return (
            <button
              key={driver.user_id}
              className={styles.driverButton}
              onClick={() => onDriverSelect(isSelected ? null : driver.user_id)}
              data-selected={isSelected}
            >
              <div className={styles.driverInfo}>
                <div className={styles.driverName}>{driver.name || driver.email}</div>
                <div className={styles.driverStats}>
                  <div>
                    {driverStat.active > 0 && (
                      <>
                        <Zap size={12} />
                        <span>{driverStat.active}</span>
                      </>
                    )}
                  </div>
                  <div>{driverStat.total} rutas</div>
                </div>
              </div>
              <ChevronDown size={18} className={styles.chevron} />
            </button>
          )
        })}
      </div>

      {selectedDriver && stats && (
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <Zap size={16} />
            <span>{stats.active} activo</span>
          </div>
          <div className={styles.summaryItem}>
            <MapPin size={16} />
            <span>{stats.total} total</span>
          </div>
        </div>
      )}
    </div>
  )
}
