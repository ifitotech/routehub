'use client'

import {Building2, FlaskConical, Plus, RefreshCw} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import Link from 'next/link'
import AdminShell from '../admin-shell'
import styles from '../admin.module.css'
import {betaAccountEmail, betaAccountPassword} from '../../../lib/beta-account'
import {roleLabelOptions} from '../../../lib/role-labels'
import type {Role} from '../../../lib/types'

type Company = {id: string; name: string; abbreviation: string | null; branch: string; manager: string; status: 'Active' | 'Trial' | 'Paused'; users: number; isBeta: boolean}

const seed: Company[] = []
const roleChoices = roleLabelOptions('en')

// One real query instead of a fixed "Active"/"0 members" on every row -
// subscription_status already exists on companies, and a per-company
// member count is one grouped query away instead of a made-up number.
async function loadCompanies(): Promise<Company[]> {
  const client = getSupabase()
  const [{data: rows, error: companyError}, {data: memberships, error: membershipError}, {data: testBranches, error: branchError}] = await Promise.all([
    client.from('companies').select('id,name,abbreviation,default_branch_name,branch_manager_name,subscription_status').order('name'),
    client.from('company_users').select('company_id,users(email)'),
    client.from('branches').select('company_id').eq('is_test', true),
  ])
  if (companyError || membershipError || branchError) throw companyError || membershipError || branchError
  const memberCounts = new Map<string, number>()
  const betaCompanies = new Set<string>()
  ;(memberships || []).forEach((row: any) => {
    memberCounts.set(row.company_id, (memberCounts.get(row.company_id) || 0) + 1)
    if (String(row.users?.email || '').toLowerCase().endsWith('@routehub.local')) betaCompanies.add(row.company_id)
  })
  ;(testBranches || []).forEach((row: {company_id: string}) => betaCompanies.add(row.company_id))
  return (rows || []).map((company: any) => ({
    id: company.id,
    name: company.name,
    abbreviation: company.abbreviation || null,
    branch: company.default_branch_name || 'Main branch',
    manager: company.branch_manager_name || 'Not assigned',
    status: company.subscription_status === 'active' ? 'Active' : company.subscription_status === 'paused' || company.subscription_status === 'cancelled' ? 'Paused' : 'Trial',
    users: memberCounts.get(company.id) || 0,
    isBeta: betaCompanies.has(company.id),
  }))
}

export default function Companies() {
  const [companies, setCompanies] = useState(seed)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [viewing, setViewing] = useState<Company | null>(null)
  const [branchForm, setBranchForm] = useState({name: '', number: '', address: '', email: ''})
  const [branchMessage, setBranchMessage] = useState('')
  const [form, setForm] = useState({name: '', abbreviation: '', branch: '', manager: '', email: ''})
  const [betaMode, setBetaMode] = useState(false)
  const [betaRole, setBetaRole] = useState<Role>('branch_manager')
  const [betaBusy, setBetaBusy] = useState(false)
  const [betaResult, setBetaResult] = useState<{email: string; password: string} | null>(null)
  const [betaError, setBetaError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setCompanies(await loadCompanies())
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load companies.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const save = async () => {
    if (!form.name.trim() || busy) return
    setBusy(true)
    setMessage('')
    try {
    if (editing) {
      const {error} = await getSupabase().rpc('platform_update_company', {company_id: editing.id, company_name: form.name.trim(), branch_name: form.branch.trim() || null, manager_name: form.manager.trim() || null, company_abbreviation: form.abbreviation.trim() || null})
      if (error) throw error
      setForm({name: '', abbreviation: '', branch: '', manager: '', email: ''}); setOpen(false); setEditing(null)
      await load()
      return
    }
    if (betaMode) {
      setBetaBusy(true); setBetaError(''); setBetaResult(null)
      try {
        const client = getSupabase()
        // platform_create_company makes the company and its first branch in
        // one call - a beta company never gets a real manager_email here, so
        // no stale "invitation pending" row is left behind once the account
        // below is created directly.
        const {data: companyId, error: createError} = await client.rpc('platform_create_company', {company_name: form.name.trim(), branch_name: form.branch.trim() || null, manager_name: null, manager_email: null, company_abbreviation: form.abbreviation.trim() || null})
        if (createError) throw createError
        const {data: branchRow, error: branchError} = await client.from('branches').select('id').eq('company_id', companyId).order('created_at', {ascending: false}).limit(1).maybeSingle()
        if (branchError) throw branchError
        if (!branchRow) throw new Error('Branch was not created.')
        const branch = {name: form.branch || 'main', branch_number: null}
        const email = betaAccountEmail(branch, betaRole)
        const password = betaAccountPassword({name: form.name, abbreviation: form.abbreviation}, branch)
        const result = await client.functions.invoke('send-manager-invite', {
          body: {action: 'create_beta_account', companyId, branchId: branchRow.id, email, password, role: betaRole},
        })
        let detail = result.error?.message || ''
        if (result.error && 'context' in result.error) { try { detail = ((await (result.error as {context: Response}).context.json()) as {error?: string}).error || detail } catch {} }
        if (result.error) throw new Error(detail)
        setBetaResult({email, password})
        setForm({name: '', abbreviation: '', branch: '', manager: '', email: ''})
        await load()
      } catch (error) {
        setBetaError(error instanceof Error ? error.message : 'Unable to create the beta tester.')
      } finally {
        setBetaBusy(false)
      }
      return
    }
    const {error} = await getSupabase().rpc('platform_create_company', {company_name: form.name.trim(), branch_name: form.branch.trim() || null, manager_name: form.manager.trim() || null, manager_email: form.email.trim() || null, company_abbreviation: form.abbreviation.trim() || null})
    if (error) throw error
    setForm({name: '', abbreviation: '', branch: '', manager: '', email: ''}); setOpen(false); setEditing(null)
    await load()
    setMessage('Company created.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save company.')
    } finally {
      setBusy(false)
    }
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
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}><button className={styles.refreshButton} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? styles.spinning : undefined}/>{loading ? 'Updating…' : 'Refresh'}</button><button className={styles.primaryButton} onClick={() => {setEditing(null); setBetaError(''); setMessage(''); setOpen(value => !value)}}><Plus size={18}/>{open ? 'Close form' : 'Add company'}</button></div>
      </header>

      {message && <p className={styles.statusMessage} role="status">{message}</p>}

      {viewing && <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{viewing.name}</h2><p>Organization overview</p></div><button className={styles.secondaryButton} onClick={() => setViewing(null)}>Close</button></header><p className={styles.subtitle}>Default branch: {viewing.branch} · Manager: {viewing.manager}</p><h3>Add branch</h3><div className={styles.formGrid}><label className={styles.field}>Branch name<input placeholder="Miami Gardens" value={branchForm.name} onChange={event => setBranchForm({...branchForm, name: event.target.value})}/></label><label className={styles.field}>Branch number<input placeholder="Branch number" value={branchForm.number} onChange={event => setBranchForm({...branchForm, number: event.target.value})}/></label><label className={styles.field}>Branch address<input placeholder="123 Main Street, Miami Gardens" value={branchForm.address} onChange={event => setBranchForm({...branchForm, address: event.target.value})}/></label><label className={styles.field}>Manager email<input type="email" placeholder="manager@company.com" value={branchForm.email} onChange={event => setBranchForm({...branchForm, email: event.target.value})}/></label><button className={styles.primaryButton} disabled={!branchForm.name.trim()} onClick={() => void addBranch()}>Add branch and invite manager</button></div>{branchMessage && <p className={styles.statusMessage}>{branchMessage}</p>}<p className={styles.subtitle}>Team members: {viewing.users}</p></section>}
      {open && <section className={styles.panel}>
        <header className={styles.panelHeader}><div><h2>{editing ? 'Edit company' : 'New company'}</h2><p>{editing ? 'Update the organization details.' : betaMode ? 'Creates the organization, its first branch, and a ready-to-use @routehub.local login for the role below - no email, no activation code.' : 'Create the organization and its first branch.'}</p></div><span className={styles.panelIcon}>{betaMode ? <FlaskConical size={21}/> : <Building2 size={21}/>}</span></header>
        {!editing && (
          <label className={styles.field} style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <input type="checkbox" checked={betaMode} onChange={event => {setBetaMode(event.target.checked); setBetaResult(null); setBetaError('')}} style={{width: 18, height: 18}}/>
            Beta tester (auto-generate an @routehub.local login instead of inviting a real manager)
          </label>
        )}
        <div className={styles.formGrid}>
          <label className={styles.field}>Company name<input aria-label="Company name" placeholder="Grey Bar" value={form.name} onChange={event => setForm({...form, name: event.target.value})}/></label>
          <label className={styles.field}>Abbreviation (optional)<input aria-label="Abbreviation" placeholder="CES" maxLength={8} value={form.abbreviation} onChange={event => setForm({...form, abbreviation: event.target.value.toUpperCase()})}/></label>
          <label className={styles.field}>First branch<input aria-label="First branch" placeholder="Hialeah" value={form.branch} onChange={event => setForm({...form, branch: event.target.value})}/></label>
          {!betaMode && <label className={styles.field}>Branch manager<input aria-label="Branch manager" placeholder="Manager name" value={form.manager} onChange={event => setForm({...form, manager: event.target.value})}/></label>}
          {!betaMode && <label className={styles.field}>Manager email<input type="email" aria-label="Manager email" placeholder="manager@company.com" value={form.email} onChange={event => setForm({...form, email: event.target.value})}/></label>}
          {betaMode && (
            <label className={styles.field}>Role
              <select aria-label="Role" value={betaRole} onChange={event => setBetaRole(event.target.value as Role)} style={{minHeight: 50, padding: '0 14px', borderRadius: 14, border: '1px solid var(--line)'}}>
                {roleChoices.map(choice => <option key={choice.role} value={choice.role}>{choice.label}</option>)}
              </select>
            </label>
          )}
          <button className={styles.primaryButton} disabled={!form.name.trim() || busy || betaBusy} onClick={() => void save()}>{editing ? (busy ? 'Saving…' : 'Save changes') : betaBusy || busy ? 'Creating…' : betaMode ? 'Create beta tester' : 'Create company'}</button>
        </div>
        {betaError && <p className={styles.statusMessage}>{betaError}</p>}
        {betaResult && (
          <div className={styles.panel} style={{marginTop: 14, background: 'var(--bg)'}}>
            <p className={styles.subtitle}>Beta tester ready - hand these to the tester directly:</p>
            <p><strong>Email:</strong> {betaResult.email}</p>
            <p><strong>Password:</strong> {betaResult.password}</p>
            <p className={styles.subtitle}>They can sign in right away at routehub-wisu.vercel.app/login and change the password from Settings.</p>
          </div>
        )}
      </section>}

      <h2 className={styles.sectionLabel}>Organizations</h2>
      <section className={styles.list} aria-label="Companies">
        {companies.map(company => <article className={styles.rowCard} key={company.id}>
          <span className={styles.rowIcon}>{company.isBeta ? <FlaskConical size={20}/> : <Building2 size={20}/>}</span>
          <div className={styles.identity}><h2>{company.name}{company.abbreviation ? ` (${company.abbreviation})` : ''}</h2><p>{company.branch} · {company.users} team {company.users === 1 ? 'member' : 'members'}</p><p>Branch manager: {company.manager}</p></div>
          <div className={styles.rowAside}>
            {company.isBeta && <span className={styles.badge} data-status="Trial">BETA</span>}
            <span className={styles.badge} data-status={company.status}>{company.status}</span>
            <Link className={styles.secondaryButton} href={`/admin/companies/${company.id}`} prefetch={false}>Open</Link>
            <button className={styles.secondaryButton} onClick={() => {setEditing(company); setBetaMode(false); setForm({name: company.name, abbreviation: company.abbreviation || '', branch: company.branch, manager: company.manager, email: ''}); setOpen(true)}}>Edit</button>
          </div>
        </article>)}
        {!companies.length && !loading && !message && <section className={styles.empty}><span><Building2 size={24}/></span><h2>No companies yet</h2><p>Create a pilot workspace when you are ready to invite the first team.</p></section>}
      </section>
  </AdminShell>
}
