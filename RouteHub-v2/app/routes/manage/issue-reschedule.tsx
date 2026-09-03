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
}: {
  route: IssueRoute
  label: string
  help: string
  typeLabel: string
  issuesLabel: string
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
      const scheduled = new Date(`${date}T${time || '09:00'}`)
      if (Number.isNaN(scheduled.getTime())) throw Error('Invalid date')
      const client = getSupabase()
      const {error} = await client.from('routes').update({
        status: 'published',
        route_date: date,
        scheduled_at: scheduled.toISOString(),
        route_started_at: null,
        route_completed_at: null,
        updated_version: Date.now(),
      }).eq('id', route.id)
      if (error) throw error
      let queueQuery = client.from('routes').select('id,position').eq('company_id', route.company_id).eq('route_date', date).eq('driver_id', route.driver_id).in('status', ['draft', 'pending', 'published', 'paused']).order('position').order('id')
      queueQuery = route.branch_id === null ? queueQuery.is('branch_id', null) : queueQuery.eq('branch_id', route.branch_id)
      const {data: queue, error: queueError} = await queueQuery
      if (queueError) throw queueError
      const ids = [...(queue ?? []).map(item => item.id).filter(id => id !== route.id), route.id]
      if (ids.length) {
        const {error: reorderError} = await client.rpc('reorder_route_queue', {p_route_ids: ids})
        if (reorderError) throw reorderError
      }
      void sendRoutePush(route.id, 'assigned')
      setOpen(false)
      setMessage('ok')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reschedule')
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
        {open && (
          <div className={styles.editor}>
            <label>Date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
            <label>Time<input type="time" value={time} onChange={event => setTime(event.target.value)} /></label>
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
