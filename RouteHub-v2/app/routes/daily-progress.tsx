'use client'

import {CheckCircle2, Clock, AlertCircle, TrendingUp} from 'lucide-react'
import styles from './daily-progress.module.css'

type DailyProgressProps = {
  total: number
  completed: number
  inProgress: number
  pending: number
  issues: number
  locale: string
}

export default function DailyProgress({
  total,
  completed,
  inProgress,
  pending,
  issues,
  locale,
}: DailyProgressProps) {
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const remaining = total - completed

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3>{locale === 'es' ? 'Progreso del Día' : locale === 'fr' ? 'Progression du Jour' : 'Daily Progress'}</h3>
          <p className={styles.subtitle}>
            {completed} {locale === 'es' ? 'de' : locale === 'fr' ? 'de' : 'of'} {total}
          </p>
        </div>
        <div className={styles.percentage}>
          <span>{completionRate}%</span>
        </div>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{width: `${completionRate}%`}} />
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem} data-type="completed">
          <CheckCircle2 size={16} />
          <div>
            <span className={styles.label}>
              {locale === 'es' ? 'Completadas' : locale === 'fr' ? 'Terminées' : 'Completed'}
            </span>
            <span className={styles.value}>{completed}</span>
          </div>
        </div>

        <div className={styles.statItem} data-type="active">
          <TrendingUp size={16} />
          <div>
            <span className={styles.label}>
              {locale === 'es' ? 'En Curso' : locale === 'fr' ? 'En Cours' : 'In Progress'}
            </span>
            <span className={styles.value}>{inProgress}</span>
          </div>
        </div>

        <div className={styles.statItem} data-type="pending">
          <Clock size={16} />
          <div>
            <span className={styles.label}>
              {locale === 'es' ? 'Pendientes' : locale === 'fr' ? 'En Attente' : 'Pending'}
            </span>
            <span className={styles.value}>{pending}</span>
          </div>
        </div>

        {issues > 0 && (
          <div className={styles.statItem} data-type="issues">
            <AlertCircle size={16} />
            <div>
              <span className={styles.label}>
                {locale === 'es' ? 'Incidencias' : locale === 'fr' ? 'Incidents' : 'Issues'}
              </span>
              <span className={styles.value}>{issues}</span>
            </div>
          </div>
        )}
      </div>

      {remaining > 0 && (
        <div className={styles.footer}>
          <p>
            {remaining} {locale === 'es' ? 'rutas por completar' : locale === 'fr' ? 'itinéraires restants' : 'routes remaining'}
          </p>
        </div>
      )}
    </div>
  )
}
