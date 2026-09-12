'use client'

import styles from './dispatch-layout.module.css'

type DispatchLayoutProps = {
  sidebar: React.ReactNode
  center: React.ReactNode
  map: React.ReactNode
  mobileToggle?: React.ReactNode
  pane?: 'list' | 'map'
  /** True while the Add Route form is open - collapses the sidebar and
   *  widens the center column instead of opening a separate overlay. */
  focus?: boolean
}

export default function DispatchLayout({sidebar, center, map, mobileToggle, pane = 'list', focus = false}: DispatchLayoutProps) {
  return (
    <div className={styles.layout} data-pane={pane}>
      {mobileToggle}
      <div className={styles.workspace} data-focus={focus ? 'true' : 'false'}>
        <div className={styles.sidebar}>{sidebar}</div>
        <div className={styles.center}>{center}</div>
        <div className={styles.map}>{map}</div>
      </div>
    </div>
  )
}
