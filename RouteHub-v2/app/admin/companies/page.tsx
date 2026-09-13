'use client'

import {Building2, Plus} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import Link from 'next/link'
import AdminShell from '../admin-shell'
import styles from '../admin.module.css'

type Company = {id: string; name: string; branch: string; manager: string; status: 'Active' | 'Trial' | 'Paused'; users: number}

const seed: Company[] = []

// One real query instead of a fixed "Active"/"0 members" on every row -
// subscription_status already exists on companies, and a per-company
// member count is one grouped query away instead of a made-up number.
async function loadCompanies(): Promise<Company[]> {
  const client = getSupabase()
  const [{data: rows}, {data: memberships}] = await Promise.all([
    client.from('companies').select('id,name,default_branch_name,branch_manager_name,subscription_status').order('name'),
    client.from('company_users').select('company_id'),
  ])
  const memberCounts = new Map<string, number>()
  ;(memberships || []).forEach((row: {company_id: string}) => memberCounts.set(row.company_id, (memberCounts.get(row.company_id) || 0) + 1))
  return (rows || []).map((company: any) => ({
    id: company.id,
    name: company.name,
    branch: company.default_branch_name || 'Main branch',
    manager: company.branch_manager_name || 'Not assigned',
    status: company.subscription_status === 'active' ? 'Active' : company.subscription_status === 'paused' || company.subscription_status === 'cancelled' ? 'Paused' : 'Trial',
    users: memberCounts.get(company.id) || 0,
  }))
}

export default function Companies() {
  const [companies, setCompanies] = useState(seed)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [viewing, setViewing] = useState<Company | null>(null)
  const [branchForm, setBranchForm] = useState({name: '', number: '', address: '', email: ''})
  const [branchMessage, setBranchMessage] = useState('')
  const [form, setForm] = useState({name: '', branch: '', manager: '', email: ''})

  useEffect(() => { void loadCompanies().then(setCompanies) }, [])

  const save = async () => {
    if (!form.name.trim()) return
    const {error} = editing
      ? await getSupabase().rpc('platform_update_company', {company_id: editing.id, company_name: form.name.trim(), branch_name: form.branch.trim() || null, manager_name: form.manager.trim() || null})
      : await getSupabase().rpc('platform_create_company', {company_name: form.name.trim(), branch_name: form.branch.trim() || null, manager_name: form.manager.trim() || null, manager_email: form.email.trim() || null})
    if (error) return
    setForm({name: '', branch: '', manager: '', email: ''}); setOpen(false); setEditing(null)
    setCompanies(await loadCompanies())
  }

  const addBranch = async () => {
    if (!viewing || !branchForm.name.trim()) return
    const {error} = await getSupabase().rpc('platform_create_branch', {company_id: viewing.id, branch_name: branchForm.name.trim(), branch_number: branchForm.number.trim() || null, branch_address: branchForm.address.trim() || null, manager_email: branchForm.email.trim() || null})
    setBranchMessage(error ? error.message : 'Branch created and invitation sent.')
    if (!error) setBranchForm({name: '', number: '', address: '', email: ''})
  }

  return <AdminShell active="companies">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>CEO / Admin · Organizations</p><h1 className={styles.title}>Companies</h1><p className={styles.subtitle}>Manage organizations and workspace status without exposing their private route data.</p></div>
        <button className={styles.primaryButton} onClick={() => {setEditing(null); setOpen(value => !value)}}><Plus size={18}/>{open ? 'Close form' : 'Add company'}</button>
      </header>

      {viewing && <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{viewing.name}</h2><p>Organization overview</p></div><button className={styles.secondaryButton} onClick={() => setViewing(null)}>Close</button></header><p className={styles.subtitle}>Default branch: {viewing.branch} · Manager: {viewing.manager}</p><h3>Add branch</h3><div className={styles.formGrid}><label className={styles.field}>Branch name<input placeholder="Miami Gardens" value={branchForm.name} onChange={event => setBranchForm({...branchForm, name: event.target.value})}/></label><label className={styles.field}>Branch number<input placeholder="Branch number" value={branchForm.number} onChange={event => setBranchForm({...branchForm, number: event.target.value})}/></label><label className={styles.field}>Branch address<input placeholder="123 Main Street, Miami Gardens" value={branchForm.address} onChange={event => setBranchForm({...branchForm, address: event.target.value})}/></label><label className={styles.field}>Manager email<input type="email" placeholder="manager@company.com" value={branchForm.email} onChange={event => setBranchForm({...branchForm, email: event.target.value})}/></label><button className={styles.primaryButton} disabled={!branchForm.name.trim()} onClick={() => void addBranch()}>Add branch and invite manager</button></div>{branchMessage && <p className={styles.statusMessage}>{branchMessage}</p>}<p className={styles.subtitle}>Team members: {viewing.users}</p></section>}
      {open && <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>{editing ? 'Edit company' : 'New company'}</h2><p>{editing ? 'Update the organization details.' : 'Create the organization and its first branch.'}</p></div><span className={styles.panelIcon}><Building2 size={21}/></span></header>
        <div className={styles.formGrid}>
          <label className={styles.field}>Company name<input aria-label="Company name" placeholder="Company name" value={form.name} onChange={event => setForm({...form, name: event.target.value})}/></label>
          <label className={styles.field}>First branch<input aria-label="First branch" placeholder="Main branch" value={form.branch} onChange={event => setForm({...form, branch: event.target.value})}/></label><label className={styles.field}>Branch manager<input aria-label="Branch manager" placeholder="Manager name" value={form.manager} onChange={event => setForm({...form, manager: event.target.value})}/></label><label className={styles.field}>Manager email<input type="email" aria-label="Manager email" placeholder="manager@company.com" value={form.email} onChange={event => setForm({...form, email: event.target.value})}/></label>
          <button className={styles.primaryButton} disabled={!form.name.trim()} onClick={() => void save()}>{editing ? 'Save changes' : 'Create company'}</button>
        </div>
      </section>}

      <h2 className={styles.sectionLabel}>Organizations</h2>
      <section className={styles.list} aria-label="Companies">
        {companies.map(company => <article className={styles.rowCard} key={company.id}>
          <span className={styles.rowIcon}><Building2 size={20}/></span>
          <div className={styles.identity}><h2>{company.name}</h2><p>{company.branch} · {company.users} team {company.users === 1 ? 'member' : 'members'}</p><p>Branch manager: {company.manager}</p></div>
          <div className={styles.rowAside}><span className={styles.badge} data-status={company.status}>{company.status}</span><Link className={styles.secondaryButton} href={`/admin/companies/${company.id}`}>Open organization</Link><button className={styles.secondaryButton} onClick={() => {setEditing(company); setForm({name: company.name, branch: company.branch, manager: company.manager, email: ''}); setOpen(true)}}>Edit</button></div>
        </article>)}
      </section>
  </AdminShell>
}
