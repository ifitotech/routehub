'use client'

import {BadgeCheck, Building2, ShieldCheck, UserCheck} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import styles from '../admin.module.css'

type Approval = {
  id: string
  email: string
  company_name: string
  requester_name?: string | null
  phone?: string | null
  status: string
  trial_ends_at?: string | null
  created_at?: string
}

export default function Approvals() {
  const [rows, setRows] = useState<Approval[]>([])
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('Loading access requests…')

  const load = async () => {
    try {
      const supabase = getSupabase()
      const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Sign in as CEO.')
      const {data: admin} = await supabase.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
      if (!admin) throw new Error('CEO access required.')
      const {data, error} = await supabase.from('platform_manager_approvals').select('id,email,company_name,requester_name,phone,status,trial_ends_at,created_at').order('created_at', {ascending: false})
      if (error) throw error
      setRows(data || [])
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load access requests.')
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

  const approve = async (id: string) => {
    const client = getSupabase()
    const {data: userData} = await client.auth.getUser()
    const {error} = await client.from('platform_manager_approvals').update({status: 'approved', approved_by: userData.user?.id, approved_at: new Date().toISOString()}).eq('id', id)
    setMessage(error ? error.message : 'Access approved. The Manager can keep using RouteHub after the trial.')
    if (!error) await load()
  }

  const revoke = async (id: string) => {
    const {error} = await getSupabase().from('platform_manager_approvals').update({status: 'revoked'}).eq('id', id)
    setMessage(error ? error.message : 'Authorization revoked.')
    if (!error) await load()
  }

  return <main className="app">
    <div className={styles.page}>
      <header className={styles.header}><div><p className={styles.eyebrow}>CEO / Admin · Access</p><h1 className={styles.title}>Access requests</h1><p className={styles.subtitle}>New Managers can use a seven-day premium trial immediately. Approve them here to continue after the trial; customer route data stays private to each company.</p></div></header>
      <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>Approve a Manager manually</h2><p>Use this for a company owner who already has an account or contacted you directly.</p></div><span className={styles.panelIcon}><ShieldCheck size={21}/></span></header>
        <div className={styles.formGrid}>
          <label className={styles.field}>Manager email<input type="email" inputMode="email" placeholder="manager@company.com" value={email} onChange={event => setEmail(event.target.value)}/></label>
          <label className={styles.field}>Company name<input placeholder="Company name" value={company} onChange={event => setCompany(event.target.value)}/></label>
          <button className={styles.primaryButton} disabled={!email.trim() || !company.trim()} onClick={add}><UserCheck size={18}/>Approve Manager</button>
        </div>
      </section>
      {message && <p className={styles.statusMessage} role="status" aria-live="polite">{message}</p>}
      <h2 className={styles.sectionLabel}>New requests and trials</h2>
      <section className={styles.list} aria-label="Manager access requests">
        {rows.map(row => <article className={styles.rowCard} key={row.id}>
          <span className={styles.rowIcon}>{row.status === 'approved' ? <BadgeCheck size={20}/> : <Building2 size={20}/>}</span>
          <div className={styles.identity}><h2>{row.company_name}</h2><p>{row.requester_name || 'Manager request'} · {row.email}</p>{row.phone && <p>{row.phone}</p>}{row.trial_ends_at && <p>Trial ends {new Date(row.trial_ends_at).toLocaleDateString()}</p>}</div>
          <div className={styles.rowAside}><span className={styles.badge} data-status={row.status}>{row.status === 'pending' ? 'Trial active' : row.status}</span>{row.status === 'pending' && <button className={styles.secondaryButton} onClick={() => approve(row.id)}>Approve</button>}{row.status === 'approved' && <button className={styles.dangerButton} onClick={() => revoke(row.id)}>Revoke</button>}</div>
        </article>)}
        {!rows.length && !message && <section className={styles.empty}><span><UserCheck size={24}/></span><h2>No access requests yet</h2><p>New trial requests will appear here automatically.</p></section>}
      </section>
    </div>
  </main>
}
