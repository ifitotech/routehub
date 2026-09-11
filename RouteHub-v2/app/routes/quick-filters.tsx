'use client'

import {Zap, Clock, CheckCircle2, AlertCircle} from 'lucide-react'
import styles from './quick-filters.module.css'

type QuickFilterOption = {
  id: string
  label: string
  icon: React.ReactNode
  isActive: boolean
  count: number
}

type QuickFiltersProps = {
  filters: QuickFilterOption[]
  onFilterToggle: (filterId: string) => void
  locale: string
}

export default function QuickFilters({filters, onFilterToggle, locale}: QuickFiltersProps) {
  return (
    <div className={styles.container}>
      <div className={styles.label}>
        {locale === 'es' ? 'Filtros rápidos' : locale === 'fr' ? 'Filtres rapides' : 'Quick filters'}
      </div>
      <div className={styles.filters}>
        {filters.map(filter => (
          <button
            key={filter.id}
            className={styles.filter}
            onClick={() => onFilterToggle(filter.id)}
            data-active={filter.isActive}
            title={filter.label}
          >
            <span className={styles.icon}>{filter.icon}</span>
            <span className={styles.text}>{filter.label}</span>
            <span className={styles.count}>{filter.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
