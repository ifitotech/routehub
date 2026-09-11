'use client'

import dynamic from 'next/dynamic'
import {useState} from 'react'
import {Maximize2, Minimize2} from 'lucide-react'
import type {OperationsDriverLocation, OperationsRoute} from '../operations-map'
import styles from './compact-map.module.css'

const OperationsMap = dynamic(() => import('../operations-map'), {ssr: false, loading: () => <div className={styles.loading} aria-hidden />})

type CompactMapProps = {
  routes: OperationsRoute[]
  driverLocations?: OperationsDriverLocation[]
  locale?: string
  interactive?: boolean
  hideFooter?: boolean
  expandLabel?: string
  collapseLabel?: string
  className?: string
}

/**
 * Shared "map is secondary" container used across Today, Routes and Add
 * Route. Renders OperationsMap compact by default; the expand button grows
 * it in place on desktop and opens a fullscreen overlay on mobile. Keeping
 * one implementation means the map behaves and looks identical everywhere
 * instead of each screen inventing its own compact/zoom mechanism.
 */
export default function CompactMap({routes, driverLocations, locale, interactive, hideFooter = true, expandLabel = 'Expand map', collapseLabel = 'Collapse map', className}: CompactMapProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`${styles.wrap} ${className || ''}`} data-expanded={expanded ? 'true' : 'false'}>
      <button type="button" className={styles.toggle} onClick={() => setExpanded(value => !value)}>
        {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        {expanded ? collapseLabel : expandLabel}
      </button>
      <OperationsMap routes={routes} driverLocations={driverLocations} locale={locale} interactive={interactive ?? expanded} hideFooter={hideFooter} />
    </div>
  )
}
