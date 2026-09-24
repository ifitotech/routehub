'use client'
import {AlertTriangle, RefreshCw, ScrollText} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import AdminShell from '../admin-shell'
import styles from '../admin.module.css'

export default function Audit() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const load = async () => {
    setLoading(true)
    setMessage('')
    try {
      const {data, error} = await getSupabase().from('platform_audit_events').select('id,action,entity_type,created_at').order('created_at', {ascending: false}).limit(50)
      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load audit activity.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])
  return (
    <AdminShell active="audit">
      <header className={styles.header}><div><p className={styles.eyebrow}>CEO / Admin · Security</p><h1 className={styles.title}>Audit activity</h1><p className={styles.subtitle}>Platform-level administrative changes only. Company routes, customers and delivery evidence remain private.</p></div><button className={styles.refreshButton} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? styles.spinning : undefined}/>{loading ? 'Updating…' : 'Refresh'}</button></header>
      {message && <section className={styles.loadError} role="alert"><AlertTriangle size={19}/><div><strong>Audit activity could not be loaded.</strong><p>{message}</p></div><button className={styles.secondaryButton} type="button" onClick={() => void load()}>Try again</button></section>}
      {events.length ? <section className={styles.list}>{events.map(event => <article className={styles.rowCard} key={event.id}><span className={styles.rowIcon}><ScrollText size={20}/></span><div className={styles.identity}><h2>{event.action.replaceAll('_', ' ')}</h2><p>{event.entity_type} · {new Date(event.created_at).toLocaleString()}</p></div></article>)}</section> : !loading && !message && <section className={styles.empty}>
        <span><ScrollText size={24}/></span>
        <h2>No audit events</h2>
        <p>Administrative changes will appear here with the date, actor and action.</p>
      </section>}
    </AdminShell>
  )
}
