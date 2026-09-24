'use client'

import styles from './dispatch-layout.module.css'

type DispatchLayoutProps = {
  // Unassigned/Issues/Completed - a single compact horizontal bar above the
  // board, never a permanent side column (unassigned-panel.tsx).
  unassignedBar: React.ReactNode
  center: React.ReactNode
  map: React.ReactNode
  // Fixed strip at the very bottom of the board - stays put while center
  // scrolls internally.
  truckBar?: React.ReactNode
  mobileToggle?: React.ReactNode
  pane?: 'list' | 'map'
  /** True while the Add Route form is open - widens the center column
   *  instead of opening a separate overlay. */
  focus?: boolean
}

export default function DispatchLayout({unassignedBar, center, map, truckBar, mobileToggle, pane = 'list', focus = false}: DispatchLayoutProps) {
  return (
    <div className={styles.layout} data-pane={pane}>
      {!focus && <div className={styles.unassignedRow}>{unassignedBar}</div>}
      {mobileToggle}
      <div className={styles.workspace} data-focus={focus ? 'true' : 'false'}>
        <div className={styles.center}>{center}</div>
        <div className={styles.map}>{map}</div>
      </div>
      {truckBar && <div className={styles.truckBar}>{truckBar}</div>}
    </div>
  )
}
