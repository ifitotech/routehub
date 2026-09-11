'use client'

import {Search, X} from 'lucide-react'
import styles from './route-search.module.css'

type RouteSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  locale: string
}

export default function RouteSearch({
  value,
  onChange,
  placeholder,
  locale,
}: RouteSearchProps) {
  return (
    <div className={styles.container}>
      <div className={styles.input}>
        <Search size={16} className={styles.icon} />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={
            placeholder ||
            (locale === 'es'
              ? 'Buscar rutas por destino...'
              : locale === 'fr'
                ? 'Rechercher des itinéraires par destination...'
                : 'Search routes by destination...')
          }
        />
        {value && (
          <button
            className={styles.clear}
            onClick={() => onChange('')}
            aria-label="Clear search"
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
