'use client'
import {Building2, ChevronLeft, Plus} from 'lucide-react'
import Link from 'next/link'
import {useParams} from 'next/navigation'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../../lib/supabase'
import styles from '../../admin.module.css'

type Branch = {id: string; name: string; branch_number?: string | null; address?: string | null}
export default function OrganizationPage() {
  const {id} = useParams<{id: string}>()
  const [company, setCompany] = useState<{name: string} | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({name: '', number: '', address: '', email: ''})
  const [message, setMessage] = useState('')
  const load = async () => {
    const client = getSupabase()
    const [{data: org}, {data: rows}] = await Promise.all([
      client.from('companies').select('name').eq('id', id).maybeSingle(),
      client.from('branches').select('id,name,branch_number,address').eq('company_id', id).order('name'),
    ])
    setCompany(org); setBranches(rows || [])
  }
  useEffect(() => { void load() }, [id])
  const addBranch = async () => {
    if (!form.name.trim()) return
    const {error} = await getSupabase().rpc('platform_create_branch', {company_id: id, branch_name: form.name.trim(), branch_number: form.number.trim() || null, branch_address: form.address.trim() || null, manager_email: form.email.trim() || null})
    setMessage(error ? error.message : 'Branch created. Invitation sent when an email was provided.')
    if (!error) { setForm({name: '', number: '', address: '', email: ''}); setOpen(false); await load() }
  }
  return <main className="app"><div className={styles.page}>
    <header className={styles.header}><div><Link className={styles.backLink} href="/admin/companies"><ChevronLeft size={16}/> Companies</Link><p className={styles.eyebrow}>CEO / Admin · Organization</p><h1 className={styles.title}>{company?.name || 'Organization'}</h1><p className={styles.subtitle}>Manage branches, managers and members for this company.</p></div><button className={styles.primaryButton} onClick={() => setOpen(!open)}><Plus size={18}/>{open ? 'Close' : 'Add branch'}</button></header>
    {open && <section className={styles.panel}><header className={styles.panelHeader}><div><h2>New branch</h2><p>Add the branch and invite its manager.</p></div><Building2 size={22}/></header><div className={styles.formGrid}><label className={styles.field}>Branch name<input placeholder="Miami Gardens" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></label><label className={styles.field}>Branch number<input placeholder="104" value={form.number} onChange={e => setForm({...form, number: e.target.value})}/></label><label className={styles.field}>Branch address<input placeholder="123 Main Street" value={form.address} onChange={e => setForm({...form, address: e.target.value})}/></label><label className={styles.field}>Manager email<input type="email" placeholder="manager@company.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></label><button className={styles.primaryButton} disabled={!form.name.trim()} onClick={() => void addBranch()}>Create branch</button></div></section>}
    {message && <p className={styles.statusMessage}>{message}</p>}
    <h2 className={styles.sectionLabel}>Organizations · {branches.length}</h2><section className={styles.list}>{branches.map(branch => <article className={styles.rowCard} key={branch.id}><span className={styles.rowIcon}><Building2 size={20}/></span><div className={styles.identity}><h2>{branch.name}</h2><p>Branch {branch.branch_number || '—'} · {branch.address || 'No address'}</p><p>Manager invitation managed by email · Members available after acceptance</p></div><span className={styles.badge} data-status="Active">Active</span></article>)}{!branches.length && <section className={styles.empty}><Building2 size={24}/><h2>No branches yet</h2><p>Add the first organization branch for this company.</p></section>}</section>
  </div></main>
}
