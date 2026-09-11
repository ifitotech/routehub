'use client'

import {MapPin, Truck, Clock, AlertCircle, CheckCircle2, Pause, X} from 'lucide-react'
import styles from './route-details-panel.module.css'

type RouteDetailsProps = {
  route: any
  onPause?: (routeId: string) => void
  onCancel?: (routeId: string) => void
  onReassign?: (routeId: string) => void
  managing?: boolean
  locale: string
  driverName?: string
}

export default function RouteDetailsPanel({
  route,
  onPause,
  onCancel,
  onReassign,
  managing = false,
  locale,
  driverName,
}: RouteDetailsProps) {
  if (!route) return null

  const isActive = ['active', 'paused'].includes(route.status || '')
  const isPaused = route.status === 'paused'
  const getStatusLabel = (status: string): string => {
    const labels: Record<string, Record<string, string>> = {
      es: {
        active: 'En curso',
        paused: 'Pausada',
        pending: 'Pendiente',
        published: 'Publicada',
        draft: 'Borrador',
        completed: 'Completada',
        issue: 'Incidencia',
        cancelled: 'Cancelada',
      },
      fr: {
        active: 'En cours',
        paused: 'Pausée',
        pending: 'En attente',
        published: 'Publiée',
        draft: 'Brouillon',
        completed: 'Terminée',
        issue: 'Incident',
        cancelled: 'Annulée',
      },
      en: {
        active: 'Active',
        paused: 'Paused',
        pending: 'Pending',
        published: 'Published',
        draft: 'Draft',
        completed: 'Completed',
        issue: 'Issue',
        cancelled: 'Cancelled',
      },
    }
    return labels[locale]?.[status] || status
  }

  const getStatusIcon = (status: string) => {
    if (['active', 'paused'].includes(status)) return <Truck size={16} className={styles.activeIcon} />
    if (status === 'completed') return <CheckCircle2 size={16} className={styles.completedIcon} />
    if (status === 'issue') return <AlertCircle size={16} className={styles.issueIcon} />
    return <Clock size={16} />
  }

  return (
    <div className={styles.panel} data-status={route.status}>
      <div className={styles.header}>
        <div className={styles.statusBadge}>
          {getStatusIcon(route.status)}
          <span>{getStatusLabel(route.status)}</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h4>{locale === 'es' ? 'Destino' : locale === 'fr' ? 'Destination' : 'Destination'}</h4>
          <p className={styles.destination}>
            {route.destination_name || route.destination_address}
          </p>
        </div>

        {driverName && (
          <div className={styles.section}>
            <h4>{locale === 'es' ? 'Conductor' : locale === 'fr' ? 'Conducteur' : 'Driver'}</h4>
            <p className={styles.value}>{driverName}</p>
          </div>
        )}

        {route.scheduled_at && (
          <div className={styles.section}>
            <h4>{locale === 'es' ? 'Programado' : locale === 'fr' ? 'Planifié' : 'Scheduled'}</h4>
            <p className={styles.value}>
              {new Date(route.scheduled_at).toLocaleTimeString(
                locale === 'es' ? 'es-ES' : locale === 'fr' ? 'fr-FR' : 'en-US',
                {hour: '2-digit', minute: '2-digit'},
              )}
            </p>
          </div>
        )}

        {route.position && (
          <div className={styles.section}>
            <h4>{locale === 'es' ? 'Posición' : locale === 'fr' ? 'Position' : 'Position'}</h4>
            <p className={styles.value}>{route.position}</p>
          </div>
        )}

        {managing && isActive && (
          <div className={styles.actions}>
            {!isPaused && onPause && (
              <button
                className={styles.actionBtn}
                data-action="pause"
                onClick={() => onPause(route.id)}
                title={locale === 'es' ? 'Pausar ruta' : locale === 'fr' ? 'Suspendre itinéraire' : 'Pause route'}
              >
                <Pause size={14} />
                {locale === 'es' ? 'Pausar' : locale === 'fr' ? 'Pause' : 'Pause'}
              </button>
            )}
            {onCancel && (
              <button
                className={styles.actionBtn}
                data-action="cancel"
                onClick={() => onCancel(route.id)}
                title={locale === 'es' ? 'Cancelar ruta' : locale === 'fr' ? 'Annuler itinéraire' : 'Cancel route'}
              >
                <X size={14} />
                {locale === 'es' ? 'Cancelar' : locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
