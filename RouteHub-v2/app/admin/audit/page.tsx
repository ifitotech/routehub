 'use client'
import {ScrollText} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import styles from '../admin.module.css'

export default function Audit() {
  const [events, setEvents] = useState<any[]>([])
  useEffect(() => { void getSupabase().from('platform_audit_events').select('id,action,entity_type,created_at').order('created_at', {ascending: false}).limit(50).then(({data}) => setEvents(data || [])) }, [])
  return <main className="app">
    <div className={styles.page}>
      <header className={styles.header}><div><p className={styles.eyebrow}>CEO / Admin · Security</p><h1 className={styles.title}>Audit activity</h1><p className={styles.subtitle}>Platform-level administrative changes only. Company routes, customers and delivery evidence remain private.</p></div></header>
      {events.length ? <section className={styles.list}>{events.map(event => <article className={styles.rowCard} key={event.id}><span className={styles.rowIcon}><ScrollText size={20}/></span><div className={styles.identity}><h2>{event.action.replaceAll('_', ' ')}</h2><p>{event.entity_type} · {new Date(event.created_at).toLocaleString()}</p></div></article>)}</section> : <section className={styles.empty}>
        <span><ScrollText size={24}/></span>
        <h2>No audit events</h2>
        <p>Administrative changes will appear here with the date, actor and action.</p>
      </section>}
    </div>
  </main>
}
