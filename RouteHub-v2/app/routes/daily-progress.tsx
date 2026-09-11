'use client'

import styles from './daily-progress.module.css'

type DailyProgressProps = {
  total: number
  completed: number
  inProgress: number
  pending: number
  issues: number
  locale: string
}

// The per-status breakdown already lives in StatusSidebar - this component's
// only job is the one thing the sidebar can't show: overall completion rate
// for the day/driver currently in view.
export default function DailyProgress({total, completed, locale}: DailyProgressProps) {
  if (total === 0) return null

  const completionRate = Math.round((completed / total) * 100)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>{locale === 'es' ? 'Progreso del día' : locale === 'fr' ? 'Progression du jour' : 'Daily progress'}</h3>
        <span className={styles.subtitle}>
          {completed} {locale === 'es' ? 'de' : locale === 'fr' ? 'sur' : 'of'} {total}
        </span>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{width: `${completionRate}%`}} />
      </div>

      <span className={styles.percentage}>{completionRate}%</span>
    </div>
  )
}
