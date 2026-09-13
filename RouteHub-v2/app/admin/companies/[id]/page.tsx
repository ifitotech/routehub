'use client'
import {Building2, ChevronLeft, Pencil, Plus, RefreshCw, Users} from 'lucide-react'
import Link from 'next/link'
import {useParams} from 'next/navigation'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../../lib/supabase'
import AdminShell from '../../admin-shell'
import styles from '../../admin.module.css'
import {slugify, randomPassword} from '../../../../lib/beta-account'
import {roleLabelOptions, roleOptions} from '../../../../lib/role-labels'
import type {Role} from '../../../../lib/types'

const roleChoices = roleLabelOptions('en')
const roleLabelFor = (role: Role) => roleChoices.find(choice => choice.role === role)?.label || role

type Member = {userId: string; role: Role; email: string; name: string | null}
type Branch = {id: string; name: string; branch_number?: string | null; address?: string | null; is_test: boolean; invite?: {email: string; status: string} | null; members: Member[]}
type Credential = {role: Role; email: string; password: string}

// One place both the single "add login" form and the "create full test
// team" bulk action call through, so both stay in sync with how a beta
// account actually gets created (and both flip the branch to Test).
async function createBetaAccount(companyId: string, branch: Branch, role: Role, email: string, password: string) {
  const result = await getSupabase().functions.invoke('send-manager-invite', {
    body: {action: 'create_beta_account', companyId, branchId: branch.id, email, password, role},
  })
  if (result.error) {
    let detail = result.error.message || ''
    if ('context' in result.error) { try { const body = await (result.error as {context: Response}).context.json(); detail = body.error || detail } catch {} }
    throw new Error(detail)
  }
  if (!branch.is_test) await getSupabase().from('branches').update({is_test: true}).eq('id', branch.id)
}

export default function OrganizationPage() {
  const {id} = useParams<{id: string}>()
  const [company, setCompany] = useState<{name: string} | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [usage, setUsage] = useState({routes: 0, drivers: 0, members: 0})
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({name: '', number: '', address: '', email: '', isTest: false})
  const [message, setMessage] = useState('')
  const [resending, setResending] = useState<string | null>(null)
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({name: '', number: '', address: '', isTest: false})
  const [savingBranch, setSavingBranch] = useState(false)

  // "Add login" - one account, for whichever single branch has its inline
  // form open right now.
  const [addLoginBranchId, setAddLoginBranchId] = useState<string | null>(null)
  const [addLoginRole, setAddLoginRole] = useState<Role>('driver')
  const [addLoginEmail, setAddLoginEmail] = useState('')
  const [addLoginEmailTouched, setAddLoginEmailTouched] = useState(false)
  const [addLoginPassword, setAddLoginPassword] = useState('')
  const [addLoginBusy, setAddLoginBusy] = useState(false)
  const [addLoginResult, setAddLoginResult] = useState<{branchId: string; email: string; password: string} | null>(null)

  // "Create full test team" - one account per role, in one click, so the
  // CEO doesn't have to repeat "add login" five times per branch.
  const [bulkBusyBranchId, setBulkBusyBranchId] = useState<string | null>(null)
  const [bulkResult, setBulkResult] = useState<{branchId: string; credentials: Credential[]} | null>(null)

  const load = async () => {
    const client = getSupabase()
    const [{data: org}, {data: rows}, {data: invites}, {count: routes}, {data: members}] = await Promise.all([
      client.from('companies').select('name').eq('id', id).maybeSingle(),
      client.from('branches').select('id,name,branch_number,address,is_test').eq('company_id', id).order('name'),
      client.from('invitations').select('branch_id,email,status,created_at').eq('company_id', id).order('created_at', {ascending: false}),
      client.from('routes').select('id', {count: 'exact', head: true}).eq('company_id', id),
      client.from('company_users').select('user_id,branch_id,role,users(email,name)').eq('company_id', id),
    ])
    const latest = new Map<string, {email: string; status: string}>()
    ;(invites || []).forEach((invite: {branch_id: string | null; email: string; status: string}) => { if (invite.branch_id && !latest.has(invite.branch_id)) latest.set(invite.branch_id, {email: invite.email, status: invite.status}) })
    const membersByBranch = new Map<string, Member[]>()
    ;(members || []).forEach((row: any) => {
      if (!row.branch_id) return
      const list = membersByBranch.get(row.branch_id) || []
      list.push({userId: row.user_id, role: row.role, email: row.users?.email || '', name: row.users?.name || null})
      membersByBranch.set(row.branch_id, list)
    })
    setCompany(org); setBranches((rows || []).map((branch: {id: string; name: string; branch_number: string | null; address: string | null; is_test: boolean}) => ({...branch, invite: latest.get(branch.id) || null, members: membersByBranch.get(branch.id) || []})))
    setUsage({routes: routes || 0, drivers: (members || []).filter((row: any) => row.role === 'driver').length, members: (members || []).length})
  }
  useEffect(() => { void load() }, [id])

  // Suggests an email as branch/role change, but never overwrites what the
  // CEO already typed - editing the field by hand opts out of auto-fill.
  useEffect(() => {
    if (addLoginEmailTouched || !addLoginBranchId || !company) return
    const branch = branches.find(b => b.id === addLoginBranchId)
    if (!branch) return
    setAddLoginEmail(`${slugify(company.name)}-${slugify(branch.name)}-${slugify(roleLabelFor(addLoginRole))}@routehub.local`)
  }, [addLoginBranchId, addLoginRole, branches, company, addLoginEmailTouched])

  const openAddLogin = (branch: Branch) => {
    const opening = addLoginBranchId !== branch.id
    setAddLoginBranchId(opening ? branch.id : null)
    setAddLoginRole('driver')
    setAddLoginEmailTouched(false)
    setAddLoginPassword(randomPassword())
    setAddLoginResult(null)
    setMessage('')
  }

  const submitAddLogin = async () => {
    const branch = branches.find(b => b.id === addLoginBranchId)
    const email = addLoginEmail.trim().toLowerCase()
    if (!branch || addLoginBusy || !email || !addLoginPassword) return
    if (!email.endsWith('@routehub.local')) { setMessage('Test user emails must end in @routehub.local.'); return }
    // That email already belongs to someone in this branch with a
    // different role - create_beta_account would silently change their
    // existing membership to this new role instead of making a separate
    // account, since it upserts on (company_id, user_id). A stale,
    // untouched email left over after creating a previous role is exactly
    // how this happens - block it instead of quietly reassigning someone.
    const collision = branch.members.find(member => member.email.toLowerCase() === email && member.role !== addLoginRole)
    if (collision) { setMessage(`${email} already exists here as ${roleLabelFor(collision.role)}. Creating it as ${roleLabelFor(addLoginRole)} would change their role instead of making a new account - use a different email.`); return }
    setAddLoginBusy(true)
    setMessage('')
    try {
      await createBetaAccount(id, branch, addLoginRole, email, addLoginPassword)
      setAddLoginResult({branchId: branch.id, email, password: addLoginPassword})
      // Reset for the next role instead of leaving this email/password
      // stuck in the field - re-enables the auto-suggested email/password
      // for whatever role gets picked next.
      setAddLoginEmailTouched(false)
      setAddLoginPassword(randomPassword())
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create test user.')
    } finally {
      setAddLoginBusy(false)
    }
  }

  const createFullTeam = async (branch: Branch) => {
    if (bulkBusyBranchId) return
    setBulkBusyBranchId(branch.id)
    setBulkResult(null)
    setMessage('')
    const credentials: Credential[] = []
    for (const role of roleOptions) {
      const email = `${slugify(company?.name || 'company')}-${slugify(branch.name)}-${slugify(roleLabelFor(role))}@routehub.local`
      const password = randomPassword()
      try {
        await createBetaAccount(id, branch, role, email, password)
        credentials.push({role, email, password})
      } catch (error) {
        setMessage(`Stopped at ${roleLabelFor(role)}: ${error instanceof Error ? error.message : 'unable to create.'}`)
        break
      }
    }
    if (credentials.length) setBulkResult({branchId: branch.id, credentials})
    await load()
    setBulkBusyBranchId(null)
  }

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
    setEditForm({name: branch.name, number: branch.branch_number || '', address: branch.address || '', isTest: branch.is_test})
    setMessage('')
  }
  const saveBranch = async () => {
    if (!editingBranchId || savingBranch || !editForm.name.trim()) return
    setSavingBranch(true)
    const {error} = await getSupabase().from('branches').update({
      name: editForm.name.trim(),
      branch_number: editForm.number.trim() || null,
      address: editForm.address.trim() || null,
      is_test: editForm.isTest,
    }).eq('id', editingBranchId)
    setMessage(error ? error.message : 'Branch updated.')
    setSavingBranch(false)
    if (!error) { setEditingBranchId(null); await load() }
  }
  const addBranch = async () => {
    if (!form.name.trim()) return
    let activationCode: string | undefined
    const {data: createdBranchId, error} = await getSupabase().rpc('platform_create_branch', {company_id: id, branch_name: form.name.trim(), branch_number: form.number.trim() || null, branch_address: form.address.trim() || null, manager_email: form.email.trim() || null})
    if (error) { setMessage(error.message); return }
    if (form.isTest) await getSupabase().from('branches').update({is_test: true}).eq('id', createdBranchId)
    if (form.email.trim()) {
      const invite = await getSupabase().functions.invoke('send-manager-invite', {body: {email: form.email.trim(), companyName: company?.name || 'RouteHub company', branchName: form.name.trim(), branchId: createdBranchId}})
      if (invite.error) { setMessage(`Branch created, but invitation failed: ${invite.error.message}`); await load(); return }
      activationCode = (invite.data as {activationCode?: string} | null)?.activationCode
    }
    setMessage(form.email.trim() ? `Branch created. Activation code: ${activationCode || 'not generated'}. Share it securely; it expires in 24 hours.` : 'Branch created.')
    setForm({name: '', number: '', address: '', email: '', isTest: false}); setOpen(false); await load()
  }

  return (
    <AdminShell active="companies">
      <header className={styles.header}>
        <div>
          <Link style={{display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--primary)', fontWeight: 700, fontSize: '.85rem', textDecoration: 'none'}} href="/admin/companies"><ChevronLeft size={16}/> Companies</Link>
          <p className={styles.eyebrow}>CEO / Admin · Organization</p>
          <h1 className={styles.title}>{company?.name || 'Organization'}</h1>
          <p className={styles.subtitle}>Branches, their team and testing logins - all in one place, grouped by branch.</p>
        </div>
        <button className={styles.primaryButton} onClick={() => setOpen(!open)}><Plus size={18}/>{open ? 'Close' : 'Add branch'}</button>
      </header>

      <section className={styles.adminStats} aria-label="Company usage">
        <article><span>Routes created</span><strong>{usage.routes}</strong><small>All-time</small></article>
        <article><span>Drivers</span><strong>{usage.drivers}</strong><small>Of {usage.members} total members</small></article>
        <article><span>Branches</span><strong>{branches.length}</strong><small>Registered locations</small></article>
      </section>

      {open && <section className={styles.panel}><header className={styles.panelHeader}><div><h2>New branch</h2><p>Add the branch and invite its manager.</p></div><Building2 size={22}/></header><div className={styles.formGrid}><label className={styles.field}>Branch name<input placeholder="Miami Gardens" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></label><label className={styles.field}>Branch code<input placeholder="OPA" value={form.number} onChange={e => setForm({...form, number: e.target.value})}/></label><label className={styles.field}>Branch address<input placeholder="123 Main Street" value={form.address} onChange={e => setForm({...form, address: e.target.value})}/></label><label className={styles.field}>Manager email<input type="email" placeholder="manager@company.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></label><label className={styles.field} style={{flexDirection: 'row', alignItems: 'center', gap: 8}}><input type="checkbox" checked={form.isTest} onChange={e => setForm({...form, isTest: e.target.checked})} style={{width: 18, height: 18}}/>Test branch</label><button className={styles.primaryButton} disabled={!form.name.trim()} onClick={() => void addBranch()}>Create branch</button></div></section>}

      {message && <p className={styles.statusMessage}>{message}</p>}

      <h2 className={styles.sectionLabel}>Branches · {branches.length}</h2>

      {editingBranchId && (() => {
        const branch = branches.find(b => b.id === editingBranchId)
        if (!branch) return null
        return (
          <section className={styles.panel} style={{marginBottom: 12}}>
            <header className={styles.panelHeader}><div><h2>Edit branch</h2><p>{branch.name}</p></div><Building2 size={22}/></header>
            <div className={styles.formGrid}>
              <label className={styles.field}>Branch name<input placeholder="Miami Gardens" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}/></label>
              <label className={styles.field}>Branch code<input placeholder="OPA" value={editForm.number} onChange={e => setEditForm({...editForm, number: e.target.value})}/></label>
              <label className={styles.field}>Branch address<input placeholder="123 Main Street" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})}/></label>
              <label className={styles.field} style={{flexDirection: 'row', alignItems: 'center', gap: 8}}><input type="checkbox" checked={editForm.isTest} onChange={e => setEditForm({...editForm, isTest: e.target.checked})} style={{width: 18, height: 18}}/>Test branch</label>
              <div style={{display: 'flex', gap: 10}}>
                <button className={styles.primaryButton} disabled={savingBranch || !editForm.name.trim()} onClick={() => void saveBranch()}>{savingBranch ? 'Saving…' : 'Save changes'}</button>
                <button className={styles.secondaryButton} onClick={() => setEditingBranchId(null)}>Cancel</button>
              </div>
            </div>
          </section>
        )
      })()}

      {branches.map(branch => {
        const pending = branch.invite && branch.invite.status === 'pending'
        return (
          <article className={styles.branchCard} key={branch.id}>
            <div className={styles.branchHead}>
              <span className={styles.rowIcon}><Building2 size={20}/></span>
              <div className={styles.identity}>
                <h2 style={{whiteSpace: 'normal'}}>{branch.name}</h2>
                <p>Branch {branch.branch_number || '—'} · {branch.address || 'No address'}</p>
                <p>{branch.invite ? `${pending ? 'Invitation pending' : `Invitation ${branch.invite.status}`} · ${branch.invite.email}` : 'No manager invitation yet'}</p>
              </div>
              <div className={styles.rowAside}>
                <span className={styles.badge} data-status={branch.is_test ? 'Trial' : 'Active'}>{branch.is_test ? 'Test' : 'Real'}</span>
                <span className={styles.badge} data-status={pending ? 'Pending' : 'Active'}>{pending ? 'Pending' : 'Active'}</span>
                <button className={styles.secondaryButton} onClick={() => startEditBranch(branch)}><Pencil size={15}/> Edit</button>
                {pending && <button className={styles.secondaryButton} disabled={resending === branch.id} onClick={() => void resendInvite(branch)}><RefreshCw size={15}/>{resending === branch.id ? 'Sending…' : 'Resend email'}</button>}
              </div>
            </div>

            <hr className={styles.branchDivider}/>

            <p className={styles.eyebrow} style={{marginBottom: 8}}>Team · {branch.members.length}</p>
            {branch.members.length > 0 ? (
              <div className={styles.memberList}>
                {branch.members.map(member => (
                  <div className={styles.memberRow} key={member.userId}>
                    <span className={styles.role}>{roleLabelFor(member.role)}</span>
                    <span className={styles.who}>{member.name || member.email || 'Unknown'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.subtitle} style={{margin: 0}}>No members in this branch yet.</p>
            )}

            <div className={styles.branchActions}>
              <button className={styles.secondaryButton} onClick={() => openAddLogin(branch)}><Users size={15}/> {addLoginBranchId === branch.id ? 'Close' : 'Add login'}</button>
              <button className={styles.secondaryButton} disabled={bulkBusyBranchId === branch.id} onClick={() => void createFullTeam(branch)}>{bulkBusyBranchId === branch.id ? 'Creating team…' : 'Create full test team'}</button>
            </div>

            {addLoginBranchId === branch.id && (
              <div className={styles.inlineForm}>
                <label className={styles.field}>Role
                  <select value={addLoginRole} onChange={e => setAddLoginRole(e.target.value as Role)}>
                    {roleChoices.map(choice => <option key={choice.role} value={choice.role}>{choice.label}</option>)}
                  </select>
                </label>
                <label className={styles.field}>Email
                  <input type="email" value={addLoginEmail} onChange={e => {setAddLoginEmail(e.target.value); setAddLoginEmailTouched(true)}} placeholder="name@routehub.local"/>
                </label>
                <label className={styles.field}>Password
                  <input type="text" value={addLoginPassword} onChange={e => setAddLoginPassword(e.target.value)}/>
                </label>
                <div style={{display: 'flex', alignItems: 'flex-end'}}>
                  <button className={styles.primaryButton} style={{width: '100%'}} disabled={addLoginBusy || !addLoginEmail.trim() || !addLoginPassword} onClick={() => void submitAddLogin()}>{addLoginBusy ? 'Creating…' : 'Create login'}</button>
                </div>
              </div>
            )}

            {addLoginResult && addLoginResult.branchId === branch.id && (
              <div className={styles.credTable}>
                <div className={styles.credRow}><span className={styles.role}>Ready</span><span className={styles.cred}>{addLoginResult.email} · {addLoginResult.password}</span></div>
              </div>
            )}

            {bulkResult && bulkResult.branchId === branch.id && (
              <div className={styles.credTable}>
                {bulkResult.credentials.map(cred => (
                  <div className={styles.credRow} key={cred.role}><span className={styles.role}>{roleLabelFor(cred.role)}</span><span className={styles.cred}>{cred.email} · {cred.password}</span></div>
                ))}
              </div>
            )}
          </article>
        )
      })}
      {!branches.length && <section className={styles.empty}><Building2 size={24}/><h2>No branches yet</h2><p>Add the first organization branch for this company.</p></section>}
    </AdminShell>
  )
}
