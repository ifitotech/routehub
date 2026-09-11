'use client'

import {AlertTriangle, Clock3, PlayCircle, CheckCircle2, Truck} from 'lucide-react'
import styles from './status-sidebar.module.css'

type StatusSection = {
  status: string
  label: string
  count: number
  icon: React.ReactNode
  routes: Array<{id: string; destination?: string; driver_name?: string; status?: string}>
}

type StatusSidebarProps = {
  sections: StatusSection[]
  selectedStatus?: string
  onStatusSelect?: (status: any) => void
  locale: string
}

export default function StatusSidebar({sections, selectedStatus, onStatusSelect, locale}: StatusSidebarProps) {
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      'in-progress': 'blue',
      'pending': 'amber',
      'completed': 'green',
      'issues': 'red',
      'unassigned': 'slate',
    }
    return colorMap[status] || 'slate'
  }

  return (
    <aside className={styles.sidebar}>
      {sections.map((section) => {
        const isSelected = selectedStatus === section.status
        const toneColor = getStatusColor(section.status)

        return (
          <div
            key={section.status}
            className={`${styles.section} ${isSelected ? styles.selected : ''}`}
            data-tone={toneColor}
          >
            <button
              className={styles.sectionHeader}
              onClick={() => onStatusSelect?.(section.status)}
              type="button"
            >
              <div className={styles.headerIcon}>{section.icon}</div>
              <div className={styles.headerLabel}>
                <h3>{section.label}</h3>
                <span className={styles.count}>{section.count}</span>
              </div>
            </button>

            {isSelected && section.routes.length > 0 && (
              <div className={styles.routeList}>
                {section.routes.map((route) => (
                  <div key={route.id} className={styles.routeItem}>
                    <div className={styles.routeDestination}>
                      {route.destination || 'No destination'}
                    </div>
                    {route.driver_name && (
                      <div className={styles.routeDriver}>
                        <Truck size={12} />
                        {route.driver_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </aside>
  )
}
