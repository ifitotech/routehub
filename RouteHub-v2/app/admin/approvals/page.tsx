'use client'

import {ShieldCheck, UserCheck} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import styles from '../admin.module.css'

type Approval = {id: string; email: string; company_name: string; status: string; created_at?: string}

export default function Approvals() {
  const [rows, setRows] = useState<Approval[]>([])
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('Loading approvals…')

  const load = async () => {
    try {
      const supabase = getSupabase()
      const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Sign in as CEO.')
      const {data: admin} = await supabase.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
      if (!admin) throw new Error('CEO access required.')
      const {data, error} = await supabase.from('platform_manager_approvals').select('id,email,company_name,status,created_at').order('created_at', {ascending: false})
      if (error) throw error
      setRows(data || [])
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load approvals.')
    }
  }

  useEffect(() => { void load() }, [])

  const add = async () => {
    if (!email.trim() || !company.trim()) return
    const supabase = getSupabase()
    const {data: userData} = await supabase.auth.getUser()
    const {error} = await supabase.from('platform_manager_approvals').insert({
      email: email.trim().toLowerCase(),
      company_name: company.trim(),
      status: 'approved',
      approved_by: userData.user?.id,
      approved_at: new Date().toISOString(),
    })
    setMessage(error ? error.message : 'Manager approved.')
    if (!error) {
      setEmail('')
      setCompany('')
      await load()
    }
  }

  const revoke = async (id: string) => {
    const {error} = await getSupabase().from('platform_manager_approvals').update({status: 'revoked'}).eq('id', id)
    setMessage(error ? error.message : 'Authorization revoked.')
    if (!error) await load()
  }

  return <main className="app">
    <div className={styles.page}>
      <header className={styles.header}><div><p className={styles.eyebrow}>CEO / Admin · Access</p><h1 className={styles.title}>Manager approvals</h1><p className={styles.subtitle}>Authorize only verified company emails. This does not expose private company route information.</p></div></header>
      <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>Authorize a Manager</h2><p>Approve the company owner or Manager responsible for their workspace.</p></div><span className={styles.panelIcon}><ShieldCheck size={21}/></span></header>
        <div className={styles.formGrid}>
          <label className={styles.field}>Manager email<input type="email" inputMode="email" placeholder="manager@company.com" value={email} onChange={event => setEmail(event.target.value)}/></label>
          <label className={styles.field}>Company name<input placeholder="Company name" value={company} onChange={event => setCompany(event.target.value)}/></label>
          <button className={styles.primaryButton} disabled={!email.trim() || !company.trim()} onClick={add}><UserCheck size={18}/>Approve Manager</button>
        </div>
      </section>
      {message && <p className={styles.statusMessage} role="status" aria-live="polite">{message}</p>}
      <h2 className={styles.sectionLabel}>Approval activity</h2>
      <section className={styles.list} aria-label="Manager approvals">
        {rows.map(row => <article className={styles.rowCard} key={row.id}>
          <span className={styles.rowIcon}><UserCheck size={20}/></span>
          <div className={styles.identity}><h2>{row.company_name}</h2><p>{row.email}{row.created_at ? ` · ${new Date(row.created_at).toLocaleDateString()}` : ''}</p></div>
          <div className={styles.rowAside}><span className={styles.badge} data-status={row.status}>{row.status}</span>{row.status === 'approved' && <button className={styles.dangerButton} onClick={() => revoke(row.id)}>Revoke</button>}</div>
        </article>)}
        {!rows.length && !message && <section className={styles.empty}><span><UserCheck size={24}/></span><h2>No approvals yet</h2><p>Approved Manager emails will appear here.</p></section>}
      </section>
    </div>
  </main>
}
