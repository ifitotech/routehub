'use client'

import {useEffect, useRef, useState} from 'react'
import {MapPin, Package, Search, Store, Truck, X} from 'lucide-react'
import styles from './route-search.module.css'
import {driverDetails, routeDate, statusLabel} from './routes-model'

type RouteSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  locale: string
  c?: any
  results?: any[]
  driverIndex?: Map<string, any>
  onSelectResult?: (route: any) => void
}

const typeIcon = (type: string | null | undefined) => type === 'pickup' ? <Package size={15}/> : type === 'return' ? <Store size={15}/> : <Truck size={15}/>

export default function RouteSearch({
  value,
  onChange,
  placeholder,
  locale,
  c,
  results,
  driverIndex,
  onSelectResult,
}: RouteSearchProps) {
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Closing on outside click (not just blur) so a click on a result row
  // itself doesn't get dismissed by the input's blur firing first.
  useEffect(() => {
    if (!focused) return
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [focused])

  const query = value.trim()
  const showDropdown = focused && query.length > 0 && Boolean(onSelectResult)
  const list = results || []

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.input}>
        <Search size={16} className={styles.icon} />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={e => { if (e.key === 'Escape') setFocused(false) }}
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
            onClick={() => { onChange(''); setFocused(false) }}
            aria-label="Clear search"
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {showDropdown && (
        <div className={styles.dropdown} role="listbox">
          {list.length === 0 ? (
            <div className={styles.empty}>{locale==='es' ? 'Sin resultados' : locale==='fr' ? 'Aucun résultat' : 'No results'}</div>
          ) : list.map(route => {
            const driver = driverDetails(route.driver_id ? driverIndex?.get(route.driver_id) : undefined, c?.teamDriver)
            return (
              <button
                key={route.id}
                type="button"
                className={styles.result}
                onClick={() => onSelectResult?.(route)}
              >
                <span className={styles.resultIcon}>{typeIcon(route.type)}</span>
                <span className={styles.resultBody}>
                  <span className={styles.resultDestination}>
                    <MapPin size={12}/>
                    {route.destination_address || route.destination_name || (locale==='es' ? 'Sin dirección' : 'No address')}
                  </span>
                  <span className={styles.resultMeta}>
                    <span>{c ? routeDate(route, locale, c) : ''}</span>
                    <span className={styles.resultDot}>•</span>
                    <span>{route.driver_id ? driver.name : (locale==='es' ? 'Sin asignar' : locale==='fr' ? 'Non assigné' : 'Unassigned')}</span>
                    {c && <span className={`${styles.resultStatus} ${styles[`status-${route.status || 'pending'}`] || ''}`}>{statusLabel(route.status, c)}</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
