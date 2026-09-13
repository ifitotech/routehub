'use client'
import {Building2, ChevronLeft, FlaskConical, Pencil, Plus, RefreshCw} from 'lucide-react'
import Link from 'next/link'
import {useParams} from 'next/navigation'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../../lib/supabase'
import AdminShell from '../../admin-shell'
import styles from '../../admin.module.css'
import {slugify, randomPassword} from '../../../../lib/beta-account'
import {roleLabelOptions} from '../../../../lib/role-labels'
import type {Role} from '../../../../lib/types'

const roleChoices = roleLabelOptions('en')

type Branch = {id: string; name: string; branch_number?: string | null; address?: string | null; invite?: {email: string; status: string} | null}
export default function OrganizationPage() {
  const {id} = useParams<{id: string}>()
  const [company, setCompany] = useState<{name: string} | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [usage, setUsage] = useState({routes: 0, drivers: 0, members: 0})
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({name: '', number: '', address: '', email: ''})
  const [message, setMessage] = useState('')
  const [resending, setResending] = useState<string | null>(null)
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({name: '', number: '', address: ''})
  const [savingBranch, setSavingBranch] = useState(false)
  const [testUserOpen, setTestUserOpen] = useState(false)
  const [testUserBranchId, setTestUserBranchId] = useState('')
  const [testUserRole, setTestUserRole] = useState<Role>('driver')
  const [testUserBusy, setTestUserBusy] = useState(false)
  const [testUserResult, setTestUserResult] = useState<{email: string; password: string} | null>(null)
  const load = async () => {
    const client = getSupabase()
    const [{data: org}, {data: rows}, {data: invites}, {count: routes}, {data: members}] = await Promise.all([
      client.from('companies').select('name').eq('id', id).maybeSingle(),
      client.from('branches').select('id,name,branch_number,address').eq('company_id', id).order('name'),
      client.from('invitations').select('branch_id,email,status,created_at').eq('company_id', id).order('created_at', {ascending: false}),
      client.from('routes').select('id', {count: 'exact', head: true}).eq('company_id', id),
      client.from('company_users').select('role').eq('company_id', id),
    ])
    const latest = new Map<string, {email: string; status: string}>()
    ;(invites || []).forEach((invite: {branch_id: string | null; email: string; status: string}) => { if (invite.branch_id && !latest.has(invite.branch_id)) latest.set(invite.branch_id, {email: invite.email, status: invite.status}) })
    setCompany(org); setBranches((rows || []).map((branch: Branch) => ({...branch, invite: latest.get(branch.id) || null})))
    setUsage({routes: routes || 0, drivers: (members || []).filter(row => row.role === 'driver').length, members: (members || []).length})
  }
  useEffect(() => { void load() }, [id])
  useEffect(() => { if (!testUserBranchId && branches.length) setTestUserBranchId(branches[0].id) }, [branches, testUserBranchId])
  const resendInvite = async (branch: Branch) => {
    if (!branch.invite?.email || resending) return
    setResending(branch.id)
    const result = await getSupabase().functions.invoke('send-manager-invite', {body: {email: branch.invite.email, companyName: company?.name || 'RouteHub company', branchName: branch.name, branchId: branch.id}})
    let detail = result.error?.message || ''
    if (result.error && 'context' in result.error) { try { const body = await (result.error as {context: Response}).context.json(); detail = body.error || detail } catch {} }
    const code = (result.data as {activationCode?: string} | null)?.activationCode
    setMessage(result.error ? `Could not resend invitation: ${detail}` : `Invitation ready for ${branch.invite.email}. Activation code: ${code || 'not generated'}. Share it securely; it expires in 24 hours.`)
    setResending(null)
  }
  const startEditBranch = (branch: Branch) => {
    setEditingBranchId(branch.id)
    setEditForm({name: branch.name, number: branch.branch_number || '', address: branch.address || ''})
    setMessage('')
  }
  const saveBranch = async () => {
    if (!editingBranchId || savingBranch || !editForm.name.trim()) return
    setSavingBranch(true)
    const {error} = await getSupabase().from('branches').update({
      name: editForm.name.trim(),
      branch_number: editForm.number.trim() || null,
      address: editForm.address.trim() || null,
    }).eq('id', editingBranchId)
    setMessage(error ? error.message : 'Branch updated.')
    setSavingBranch(false)
    if (!error) { setEditingBranchId(null); await load() }
  }
  const createTestUser = async () => {
    const branch = branches.find(b => b.id === testUserBranchId)
    if (!branch || testUserBusy) return
    setTestUserBusy(true)
    setMessage('')
    setTestUserResult(null)
    try {
      const roleSlug = roleChoices.find(choice => choice.role === testUserRole)?.label || testUserRole
      const email = `${slugify(company?.name || 'company')}-${slugify(branch.name)}-${slugify(roleSlug)}@routehub.local`
      const password = randomPassword()
      const result = await getSupabase().functions.invoke('send-manager-invite', {
        body: {action: 'create_beta_account', companyId: id, branchId: branch.id, email, password, role: testUserRole},
      })
      let detail = result.error?.message || ''
      if (result.error && 'context' in result.error) { try { const body = await (result.error as {context: Response}).context.json(); detail = body.error || detail } catch {} }
      if (result.error) throw new Error(detail)
      setTestUserResult({email, password})
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create test user.')
    } finally {
      setTestUserBusy(false)
    }
  }
  const addBranch = async () => {
    if (!form.name.trim()) return
    let activationCode: string | undefined
    const {data: createdBranchId, error} = await getSupabase().rpc('platform_create_branch', {company_id: id, branch_name: form.name.trim(), branch_number: form.number.trim() || null, branch_address: form.address.trim() || null, manager_email: form.email.trim() || null})
    if (error) { setMessage(error.message); return }
    if (form.email.trim()) {
      const invite = await getSupabase().functions.invoke('send-manager-invite', {body: {email: form.email.trim(), companyName: company?.name || 'RouteHub company', branchName: form.name.trim(), branchId: createdBranchId}})
      if (invite.error) { setMessage(`Branch created, but invitation failed: ${invite.error.message}`); await load(); return }
      activationCode = (invite.data as {activationCode?: string} | null)?.activationCode
    }
    setMessage(form.email.trim() ? `Branch created. Activation code: ${activationCode || 'not generated'}. Share it securely; it expires in 24 hours.` : 'Branch created.')
    setForm({name: '', number: '', address: '', email: ''}); setOpen(false); await load()
  }
  return (
    <AdminShell active="companies">
      <header className={styles.header}><div><Link style={{display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--primary)', fontWeight: 700, fontSize: '.85rem', textDecoration: 'none'}} href="/admin/companies"><ChevronLeft size={16}/> Companies</Link><p className={styles.eyebrow}>CEO / Admin · Organization</p><h1 className={styles.title}>{company?.name || 'Organization'}</h1><p className={styles.subtitle}>Manage branches, managers and members for this company.</p></div><div style={{display: 'flex', gap: 10}}><button className={styles.secondaryButton} onClick={() => {setTestUserOpen(!testUserOpen); setTestUserResult(null)}}><FlaskConical size={18}/>{testUserOpen ? 'Close' : 'Add test user'}</button><button className={styles.primaryButton} onClick={() => setOpen(!open)}><Plus size={18}/>{open ? 'Close' : 'Add branch'}</button></div></header>

      {testUserOpen && (
        <section className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Add test user</h2><p>Creates a ready-to-use @routehub.local login for any role on an existing branch - City Electric uses Sales, Operations, Counter and Driver, but another company might need a different mix.</p></div><FlaskConical size={22}/></header>
          <div className={styles.formGrid}>
            <label className={styles.field}>Branch
              <select value={testUserBranchId} onChange={e => setTestUserBranchId(e.target.value)} style={{minHeight: 50, padding: '0 14px', borderRadius: 14, border: '1px solid var(--line)'}}>
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label className={styles.field}>Role
              <select value={testUserRole} onChange={e => setTestUserRole(e.target.value as Role)} style={{minHeight: 50, padding: '0 14px', borderRadius: 14, border: '1px solid var(--line)'}}>
                {roleChoices.map(choice => <option key={choice.role} value={choice.role}>{choice.label}</option>)}
              </select>
            </label>
            <button className={styles.primaryButton} disabled={!testUserBranchId || testUserBusy} onClick={() => void createTestUser()}>{testUserBusy ? 'Creating…' : 'Create test user'}</button>
          </div>
          {testUserResult && (
            <div className={styles.panel} style={{marginTop: 14, background: 'var(--bg, #f7f9fc)'}}>
              <p className={styles.subtitle}>Test user ready - hand these to the tester directly:</p>
              <p><strong>Email:</strong> {testUserResult.email}</p>
              <p><strong>Password:</strong> {testUserResult.password}</p>
            </div>
          )}
        </section>
      )}
      <section className={styles.adminStats} aria-label="Company usage">
        <article><span>Routes created</span><strong>{usage.routes}</strong><small>All-time</small></article>
        <article><span>Drivers</span><strong>{usage.drivers}</strong><small>Of {usage.members} total members</small></article>
        <article><span>Branches</span><strong>{branches.length}</strong><small>Registered locations</small></article>
      </section>
      {open && <section className={styles.panel}><header className={styles.panelHeader}><div><h2>New branch</h2><p>Add the branch and invite its manager.</p></div><Building2 size={22}/></header><div className={styles.formGrid}><label className={styles.field}>Branch name<input placeholder="Miami Gardens" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></label><label className={styles.field}>Branch code<input placeholder="OPA" value={form.number} onChange={e => setForm({...form, number: e.target.value})}/></label><label className={styles.field}>Branch address<input placeholder="123 Main Street" value={form.address} onChange={e => setForm({...form, address: e.target.value})}/></label><label className={styles.field}>Manager email<input type="email" placeholder="manager@company.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></label><button className={styles.primaryButton} disabled={!form.name.trim()} onClick={() => void addBranch()}>Create branch</button></div></section>}
      {message && <p className={styles.statusMessage}>{message}</p>}
      <h2 className={styles.sectionLabel}>Branches · {branches.length}</h2>
      <section className={styles.list}>
        {branches.map(branch => {
          const pending = branch.invite && branch.invite.status === 'pending'
          if (editingBranchId === branch.id) {
            return (
              <article className={styles.panel} key={branch.id}>
                <header className={styles.panelHeader}><div><h2>Edit branch</h2><p>{branch.name}</p></div><Building2 size={22}/></header>
                <div className={styles.formGrid}>
                  <label className={styles.field}>Branch name<input placeholder="Miami Gardens" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}/></label>
                  <label className={styles.field}>Branch code<input placeholder="OPA" value={editForm.number} onChange={e => setEditForm({...editForm, number: e.target.value})}/></label>
                  <label className={styles.field}>Branch address<input placeholder="123 Main Street" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})}/></label>
                  <div style={{display: 'flex', gap: 10}}>
                    <button className={styles.primaryButton} disabled={savingBranch || !editForm.name.trim()} onClick={() => void saveBranch()}>{savingBranch ? 'Saving…' : 'Save changes'}</button>
                    <button className={styles.secondaryButton} onClick={() => setEditingBranchId(null)}>Cancel</button>
                  </div>
                </div>
              </article>
            )
          }
          return (
            <article className={styles.rowCard} key={branch.id}>
              <span className={styles.rowIcon}><Building2 size={20}/></span>
              <div className={styles.identity}>
                <h2>{branch.name}</h2>
                <p>Branch {branch.branch_number || '—'} · {branch.address || 'No address'}</p>
                <p>{branch.invite ? `${pending ? 'Invitation pending' : `Invitation ${branch.invite.status}`} · ${branch.invite.email}` : 'No manager invitation yet'}</p>
              </div>
              <div className={styles.rowAside}>
                <span className={styles.badge} data-status={pending ? 'Pending' : 'Active'}>{pending ? 'Pending' : 'Active'}</span>
                <button className={styles.secondaryButton} onClick={() => startEditBranch(branch)}><Pencil size={15}/> Edit</button>
                {pending && <button className={styles.secondaryButton} disabled={resending === branch.id} onClick={() => void resendInvite(branch)}><RefreshCw size={15}/>{resending === branch.id ? 'Sending…' : 'Resend email'}</button>}
              </div>
            </article>
          )
        })}
        {!branches.length && <section className={styles.empty}><Building2 size={24}/><h2>No branches yet</h2><p>Add the first organization branch for this company.</p></section>}
      </section>
    </AdminShell>
  )
}
