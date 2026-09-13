'use client'

import {ShieldAlert, ShieldCheck, Trash2, UserPlus} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import AdminShell from '../admin-shell'
import styles from '../admin.module.css'

type AdminRow = {user_id: string; created_at: string; email?: string; name?: string | null}

export default function PlatformAdmins() {
  const [rows, setRows] = useState<AdminRow[]>([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Loading platform admins…')
  const [selfId, setSelfId] = useState('')

  const load = async () => {
    try {
      const supabase = getSupabase()
      const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Sign in as CEO.')
      setSelfId(userData.user.id)
      const {data: admin} = await supabase.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
      if (!admin) throw new Error('CEO access required.')
      const {data, error} = await supabase.from('platform_admins').select('user_id,created_at').order('created_at')
      if (error) throw error
      const ids = (data || []).map(row => row.user_id)
      const {data: people} = ids.length ? await supabase.from('users').select('id,email,name').in('id', ids) : {data: []}
      const byId = new Map((people || []).map((person: {id: string; email: string; name: string | null}) => [person.id, person]))
      setRows((data || []).map(row => ({...row, email: byId.get(row.user_id)?.email, name: byId.get(row.user_id)?.name})))
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load platform admins.')
    }
  }
  useEffect(() => { void load() }, [])

  const add = async () => {
    const normalized = email.trim().toLowerCase()
    if (!normalized || busy) return
    setBusy(true)
    try {
      const supabase = getSupabase()
      const {data: person, error: lookupError} = await supabase.from('users').select('id').ilike('email', normalized).maybeSingle()
      if (lookupError) throw lookupError
      if (!person) throw new Error('No RouteHub account uses that email yet - they need to sign in at least once first.')
      const {error} = await supabase.from('platform_admins').insert({user_id: person.id})
      if (error) throw error
      setEmail('')
      setMessage('Admin access granted.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to grant admin access.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (userId: string) => {
    if (userId === selfId && rows.length <= 1) { setMessage('You are the only platform admin - add another one before removing yourself.'); return }
    const {error} = await getSupabase().from('platform_admins').delete().eq('user_id', userId)
    setMessage(error ? error.message : 'Admin access removed.')
    if (!error) await load()
  }

  return (
    <AdminShell active="admins">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CEO / Admin · Security</p>
          <h1 className={styles.title}>Platform admins</h1>
          <p className={styles.subtitle}>Everyone with CEO-level access to every company on RouteHub. Grant this rarely.</p>
        </div>
      </header>

      <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>Grant admin access</h2><p>The person needs a RouteHub account already (they must have signed in at least once).</p></div><span className={styles.panelIcon}><UserPlus size={21}/></span></header>
        <div className={styles.formGrid}>
          <label className={styles.field}>Email<input type="email" inputMode="email" placeholder="cofounder@routehub.local" value={email} onChange={event => setEmail(event.target.value)}/></label>
          <button className={styles.primaryButton} disabled={busy || !email.trim()} onClick={() => void add()}><ShieldCheck size={18}/>Grant access</button>
        </div>
      </section>

      {message && <p className={styles.statusMessage}>{message}</p>}

      <h2 className={styles.sectionLabel}>Current admins · {rows.length}</h2>
      <section className={styles.list} aria-label="Platform admins">
        {rows.map(row => (
          <article key={row.user_id} className={styles.rowCard}>
            <span className={styles.rowIcon}><ShieldCheck size={20}/></span>
            <div className={styles.identity}><h2>{row.name || row.email || 'Unknown'}</h2><p>{row.email}{row.user_id === selfId ? ' · You' : ''}</p></div>
            <div className={styles.rowAside}>
              <button className={styles.dangerButton} onClick={() => void remove(row.user_id)}><Trash2 size={14}/> Remove</button>
            </div>
          </article>
        ))}
        {!rows.length && !message && <section className={styles.empty}><span><ShieldAlert size={24}/></span><h2>No platform admins found</h2><p>Something is wrong - this screen should not be reachable without one.</p></section>}
      </section>
    </AdminShell>
  )
}
