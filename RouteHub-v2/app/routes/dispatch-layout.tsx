'use client'

import styles from './dispatch-layout.module.css'

type DispatchLayoutProps = {
  sidebar: React.ReactNode
  center: React.ReactNode
  map: React.ReactNode
  mobileToggle?: React.ReactNode
  pane?: 'list' | 'map'
}

export default function DispatchLayout({sidebar, center, map, mobileToggle, pane = 'list'}: DispatchLayoutProps) {
  return (
    <div className={styles.layout} data-pane={pane}>
      {mobileToggle}
      <div className={styles.workspace}>
        <div className={styles.sidebar}>{sidebar}</div>
        <div className={styles.center}>{center}</div>
        <div className={styles.map}>{map}</div>
      </div>
    </div>
  )
}
