'use client'

import {useState} from 'react'
import {CalendarClock} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import {sendRoutePush} from '../../../lib/route-push'
import styles from './manage.module.css'
import fixes from './manage-mobile-fixes.module.css'

type IssueRoute = {
  id: string
  company_id: string
  branch_id: string | null
  driver_id: string
  destination?: string
  destination_name?: string
  driver_note?: string | null
  position: number
}

function localDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export default function IssueReschedule({
  route,
  label,
  help,
  typeLabel,
  issuesLabel,
  dateLabel,
  timeLabel,
  noteLabel,
  invalidDateMessage,
  offlineMessage,
  errorMessage,
}: {
  route: IssueRoute
  label: string
  help: string
  typeLabel: string
  issuesLabel: string
  dateLabel: string
  timeLabel: string
  noteLabel: string
  invalidDateMessage: string
  offlineMessage: string
  errorMessage: string
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(localDate)
  const [time, setTime] = useState('09:00')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) throw Error(offlineMessage)
      const scheduled = new Date(`${date}T${time || '09:00'}`)
      if (Number.isNaN(scheduled.getTime())) throw Error(invalidDateMessage)
      const client = getSupabase()
      const {error} = await client.rpc('reschedule_issue_route', {
        p_route_id: route.id,
        p_route_date: date,
        p_scheduled_at: scheduled.toISOString(),
      })
      if (error) throw error
      void sendRoutePush(route.id, 'assigned')
      setOpen(false)
      setMessage('ok')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={`${styles.route} ${styles.issueRoute} ${fixes.card}`}>
      <span className={styles.gripPlaceholder} aria-hidden="true" />
      <span className={`${styles.position} ${styles.issuePosition}`}>{String(route.position).padStart(2, '0')}</span>
      <div className={`${styles.routeMain} ${fixes.content}`}>
        <div className={styles.meta}><b>{typeLabel}</b><span className={styles.statusIssue}>{issuesLabel}</span></div>
        <h2>{route.destination_name || route.destination || 'Destination'}</h2>
        {route.driver_note ? <p><strong>{noteLabel}:</strong> {route.driver_note}</p> : null}
        {open && (
          <div className={styles.editor}>
            <label>{dateLabel}<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
            <label>{timeLabel}<input type="time" value={time} onChange={event => setTime(event.target.value)} /></label>
            <p>{help}</p>
            <button className="primary" type="button" disabled={saving} onClick={() => void save()}>{label}</button>
            {message && message !== 'ok' && <small>{message}</small>}
          </div>
        )}
      </div>
      <div className={`${styles.actions} ${fixes.cardActions}`}>
        <button type="button" aria-label={label} disabled={saving} onClick={() => setOpen(value => !value)}><CalendarClock /></button>
      </div>
    </article>
  )
}
