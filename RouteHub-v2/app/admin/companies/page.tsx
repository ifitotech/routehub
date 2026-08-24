'use client'

import {Building2, Plus} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import styles from '../admin.module.css'

type Company = {id: number; name: string; branch: string; status: 'Active' | 'Trial' | 'Paused'; users: number}

const seed: Company[] = []

export default function Companies() {
  const [companies, setCompanies] = useState(seed)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({name: '', branch: ''})

  useEffect(() => {
    const load = async () => {
      const {data} = await getSupabase().from('companies').select('id,name').order('name')
      if (data) setCompanies(data.map(company => ({id: company.id, name: company.name, branch: 'Workspace', status: 'Active' as const, users: 0})))
    }
    void load()
  }, [])

  const save = async () => {
    if (!form.name.trim()) return
    const {error} = await getSupabase().rpc('platform_create_company', {company_name: form.name.trim(), branch_name: form.branch.trim() || null})
    if (error) return
    setForm({name: '', branch: ''}); setOpen(false)
    const {data} = await getSupabase().from('companies').select('id,name').order('name')
    if (data) setCompanies(data.map(company => ({id: company.id, name: company.name, branch: 'Workspace', status: 'Active' as const, users: 0})))
  }

  return <main className="app">
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>CEO / Admin · Organizations</p><h1 className={styles.title}>Companies</h1><p className={styles.subtitle}>Manage organizations and workspace status without exposing their private route data.</p></div>
        <button className={styles.primaryButton} onClick={() => setOpen(value => !value)}><Plus size={18}/>{open ? 'Close form' : 'Add company'}</button>
      </header>

      {open && <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>New company</h2><p>Create the organization and its first branch.</p></div><span className={styles.panelIcon}><Building2 size={21}/></span></header>
        <div className={styles.formGrid}>
          <label className={styles.field}>Company name<input aria-label="Company name" placeholder="Company name" value={form.name} onChange={event => setForm({...form, name: event.target.value})}/></label>
          <label className={styles.field}>First branch<input aria-label="First branch" placeholder="Main branch" value={form.branch} onChange={event => setForm({...form, branch: event.target.value})}/></label>
          <button className={styles.primaryButton} disabled={!form.name.trim()} onClick={save}>Create company</button>
        </div>
      </section>}

      <h2 className={styles.sectionLabel}>Organizations</h2>
      <section className={styles.list} aria-label="Companies">
        {companies.map(company => <article className={styles.rowCard} key={company.id}>
          <span className={styles.rowIcon}><Building2 size={20}/></span>
          <div className={styles.identity}><h2>{company.name}</h2><p>{company.branch} · {company.users} team {company.users === 1 ? 'member' : 'members'}</p></div>
          <div className={styles.rowAside}><span className={styles.badge} data-status={company.status}>{company.status}</span><button className={styles.secondaryButton}>View organization</button><button className={styles.secondaryButton}>Edit</button></div>
        </article>)}
      </section>
    </div>
  </main>
}
