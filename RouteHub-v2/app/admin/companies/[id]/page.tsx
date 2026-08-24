'use client'
import {Building2, ChevronLeft, Plus, RefreshCw} from 'lucide-react'
import Link from 'next/link'
import {useParams} from 'next/navigation'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../../lib/supabase'
import styles from '../../admin.module.css'

type Branch = {id: string; name: string; branch_number?: string | null; address?: string | null; invite?: {email: string; status: string} | null}
export default function OrganizationPage() {
  const {id} = useParams<{id: string}>()
  const [company, setCompany] = useState<{name: string} | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({name: '', number: '', address: '', email: ''})
  const [message, setMessage] = useState('')
  const [resending, setResending] = useState<string | null>(null)
  const load = async () => {
    const client = getSupabase()
    const [{data: org}, {data: rows}, {data: invites}] = await Promise.all([
      client.from('companies').select('name').eq('id', id).maybeSingle(),
      client.from('branches').select('id,name,branch_number,address').eq('company_id', id).order('name'),
      client.from('invitations').select('branch_id,email,status,created_at').eq('company_id', id).order('created_at', {ascending: false}),
    ])
    const latest = new Map<string, {email: string; status: string}>()
    ;(invites || []).forEach((invite: {branch_id: string | null; email: string; status: string}) => { if (invite.branch_id && !latest.has(invite.branch_id)) latest.set(invite.branch_id, {email: invite.email, status: invite.status}) })
    setCompany(org); setBranches((rows || []).map((branch: Branch) => ({...branch, invite: latest.get(branch.id) || null})))
  }
  useEffect(() => { void load() }, [id])
  const resendInvite = async (branch: Branch) => {
    if (!branch.invite?.email || resending) return
    setResending(branch.id)
    const result = await getSupabase().functions.invoke('send-manager-invite', {body: {email: branch.invite.email, companyName: company?.name || 'RouteHub company', branchName: branch.name}})
    let detail = result.error?.message || ''
    if (result.error && 'context' in result.error) { try { const body = await (result.error as {context: Response}).context.json(); detail = body.error || detail } catch {} }
    if (result.error && detail.toLowerCase().includes('already been registered')) {
      const reset = await getSupabase().auth.resetPasswordForEmail(branch.invite.email, {redirectTo: 'https://routehub-wisu.vercel.app/login'})
      setMessage(reset.error ? `Could not send password setup email: ${reset.error.message}` : `Password setup email sent to ${branch.invite.email}.`)
    } else setMessage(result.error ? `Could not resend invitation: ${detail}` : `Invitation resent to ${branch.invite.email}.`)
    setResending(null)
  }
  const addBranch = async () => {
    if (!form.name.trim()) return
    const {error} = await getSupabase().rpc('platform_create_branch', {company_id: id, branch_name: form.name.trim(), branch_number: form.number.trim() || null, branch_address: form.address.trim() || null, manager_email: form.email.trim() || null})
    if (error) { setMessage(error.message); return }
    if (form.email.trim()) {
      const invite = await getSupabase().functions.invoke('send-manager-invite', {body: {email: form.email.trim(), companyName: company?.name || 'RouteHub company', branchName: form.name.trim()}})
      if (invite.error) { setMessage(`Branch created, but invitation failed: ${invite.error.message}`); await load(); return }
    }
    setMessage(form.email.trim() ? 'Branch created and invitation sent.' : 'Branch created.')
    setForm({name: '', number: '', address: '', email: ''}); setOpen(false); await load()
  }
  return <main className="app"><div className={styles.page}>
    <header className={styles.header}><div><Link className={styles.backLink} href="/admin/companies"><ChevronLeft size={16}/> Companies</Link><p className={styles.eyebrow}>CEO / Admin · Organization</p><h1 className={styles.title}>{company?.name || 'Organization'}</h1><p className={styles.subtitle}>Manage branches, managers and members for this company.</p></div><button className={styles.primaryButton} onClick={() => setOpen(!open)}><Plus size={18}/>{open ? 'Close' : 'Add branch'}</button></header>
    {open && <section className={styles.panel}><header className={styles.panelHeader}><div><h2>New branch</h2><p>Add the branch and invite its manager.</p></div><Building2 size={22}/></header><div className={styles.formGrid}><label className={styles.field}>Branch name<input placeholder="Miami Gardens" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></label><label className={styles.field}>Branch code<input placeholder="OPA" value={form.number} onChange={e => setForm({...form, number: e.target.value})}/></label><label className={styles.field}>Branch address<input placeholder="123 Main Street" value={form.address} onChange={e => setForm({...form, address: e.target.value})}/></label><label className={styles.field}>Manager email<input type="email" placeholder="manager@company.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></label><button className={styles.primaryButton} disabled={!form.name.trim()} onClick={() => void addBranch()}>Create branch</button></div></section>}
    {message && <p className={styles.statusMessage}>{message}</p>}
    <h2 className={styles.sectionLabel}>Organizations · {branches.length}</h2><section className={styles.list}>{branches.map(branch => { const pending = branch.invite && branch.invite.status === 'pending'; return <article className={styles.rowCard} key={branch.id}><span className={styles.rowIcon}><Building2 size={20}/></span><div className={styles.identity}><h2>{branch.name}</h2><p>Branch {branch.branch_number || '—'} · {branch.address || 'No address'}</p><p>{branch.invite ? `${pending ? 'Invitation pending' : `Invitation ${branch.invite.status}`} · ${branch.invite.email}` : 'No manager invitation yet'}</p></div><span className={styles.badge} data-status={pending ? 'Pending' : 'Active'}>{pending ? 'Pending' : 'Active'}</span>{pending && <button className={styles.secondaryButton} disabled={resending === branch.id} onClick={() => void resendInvite(branch)}><RefreshCw size={15}/>{resending === branch.id ? 'Sending…' : 'Resend email'}</button>}</article>})}{!branches.length && <section className={styles.empty}><Building2 size={24}/><h2>No branches yet</h2><p>Add the first organization branch for this company.</p></section>}</section>
  </div></main>
}
