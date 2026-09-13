'use client'

import {BadgeCheck, Building2, CreditCard, ShieldCheck} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import AdminShell from '../admin-shell'
import styles from '../admin.module.css'

type Trial = {
  id: string
  email: string
  company_name: string
  requester_name?: string | null
  status: string
  company_id: string | null
  trial_ends_at?: string | null
  created_at?: string
}

type Company = {
  id: string
  name: string
  plan: string
  subscription_status: string
  trial_ends_at: string | null
  max_drivers: number
}

const plans = ['free', 'plus', 'pro', 'enterprise']

export default function Billing() {
  const [trials, setTrials] = useState<Trial[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [message, setMessage] = useState('Loading billing…')

  const load = async () => {
    try {
      const supabase = getSupabase()
      const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Sign in as CEO.')
      const {data: admin} = await supabase.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
      if (!admin) throw new Error('CEO access required.')
      const [{data: trialRows, error: trialError}, {data: companyRows, error: companyError}] = await Promise.all([
        supabase.from('platform_manager_approvals').select('id,email,company_name,requester_name,status,company_id,trial_ends_at,created_at').order('created_at', {ascending: false}),
        supabase.from('companies').select('id,name,plan,subscription_status,trial_ends_at,max_drivers').order('name'),
      ])
      if (trialError) throw trialError
      if (companyError) throw companyError
      setTrials(trialRows || [])
      setCompanies((companyRows || []) as Company[])
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load billing.')
    }
  }
  useEffect(() => { void load() }, [])

  // A trial request created before the self-serve flow existed has no
  // company_id - there is nothing on this screen that can act on it, since
  // every real lever (plan, status, trial date) lives on the companies
  // table keyed by company_id.
  const linkedTrials = trials.filter(trial => trial.company_id)

  const approve = async (id: string) => {
    const client = getSupabase()
    const {data: userData} = await client.auth.getUser()
    const {error} = await client.from('platform_manager_approvals').update({status: 'approved', approved_by: userData.user?.id, approved_at: new Date().toISOString()}).eq('id', id)
    setMessage(error ? error.message : 'Access approved beyond the trial.')
    if (!error) await load()
  }
  const revoke = async (id: string) => {
    const {error} = await getSupabase().from('platform_manager_approvals').update({status: 'revoked'}).eq('id', id)
    setMessage(error ? error.message : 'Access revoked.')
    if (!error) await load()
  }
  const updateCompany = async (companyId: string, patch: {plan?: string; subscription_status?: string; trial_ends_at?: string | null}) => {
    const {error} = await getSupabase().rpc('platform_update_company_billing', {company_id: companyId, plan: patch.plan ?? null, subscription_status: patch.subscription_status ?? null, trial_ends_at: patch.trial_ends_at ?? null})
    setMessage(error ? error.message : 'Company updated.')
    if (!error) await load()
  }

  return (
    <AdminShell active="billing">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CEO / Admin · Billing</p>
          <h1 className={styles.title}>Billing</h1>
          <p className={styles.subtitle}>Plan, subscription status and trial access for every company - the same fields that used to only be editable straight in the database.</p>
        </div>
      </header>

      {message && <p className={styles.statusMessage}>{message}</p>}

      <h2 className={styles.sectionLabel}>Companies</h2>
      <section className={styles.list} aria-label="Company plans">
        {companies.map(company => (
          <article key={company.id} className={styles.rowCard} style={{gridTemplateColumns: '48px minmax(0, 1fr) auto', alignItems: 'center'}}>
            <span className={styles.rowIcon}><CreditCard size={20}/></span>
            <div className={styles.identity} style={{overflow: 'visible', whiteSpace: 'normal'}}>
              <h2 style={{whiteSpace: 'normal'}}>{company.name}</h2>
              <p>{company.max_drivers} driver{company.max_drivers === 1 ? '' : 's'} allowed{company.trial_ends_at ? ` · Trial ends ${new Date(company.trial_ends_at).toLocaleDateString()}` : ''}</p>
            </div>
            <div className={styles.rowAside} style={{flexWrap: 'wrap', justifyContent: 'flex-end'}}>
              <label className={styles.field} style={{gap: 4}}>
                <span style={{fontSize: '.7rem'}}>Plan</span>
                <select value={company.plan} onChange={event => void updateCompany(company.id, {plan: event.target.value})} style={{minHeight: 38, padding: '0 10px', borderRadius: 10, border: '1px solid var(--line)'}}>
                  {plans.map(plan => <option key={plan} value={plan}>{plan}</option>)}
                </select>
              </label>
              <label className={styles.field} style={{gap: 4}}>
                <span style={{fontSize: '.7rem'}}>Status</span>
                <select value={company.subscription_status} onChange={event => void updateCompany(company.id, {subscription_status: event.target.value})} style={{minHeight: 38, padding: '0 10px', borderRadius: 10, border: '1px solid var(--line)'}}>
                  {['trialing', 'active', 'paused', 'cancelled'].map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <span className={styles.badge} data-status={company.subscription_status === 'active' ? 'Active' : company.subscription_status === 'trialing' ? 'Trial' : 'Paused'}>{company.subscription_status}</span>
            </div>
          </article>
        ))}
        {!companies.length && !message && <section className={styles.empty}><span><Building2 size={24}/></span><h2>No companies yet</h2><p>Companies will appear here once created.</p></section>}
      </section>

      <h2 className={styles.sectionLabel}>Trial requests</h2>
      <section className={styles.list} aria-label="Trial requests">
        {linkedTrials.map(trial => (
          <article className={styles.rowCard} key={trial.id}>
            <span className={styles.rowIcon}>{trial.status === 'approved' ? <BadgeCheck size={20}/> : <ShieldCheck size={20}/>}</span>
            <div className={styles.identity}><h2>{trial.company_name}</h2><p>{trial.requester_name || 'Manager request'} · {trial.email}</p>{trial.trial_ends_at && <p>Trial ends {new Date(trial.trial_ends_at).toLocaleDateString()}</p>}</div>
            <div className={styles.rowAside}>
              <span className={styles.badge} data-status={trial.status === 'pending' ? 'Trial' : trial.status}>{trial.status === 'pending' ? 'Trial active' : trial.status}</span>
              {trial.status === 'pending' && <button className={styles.secondaryButton} onClick={() => void approve(trial.id)}>Approve</button>}
              {trial.status === 'approved' && <button className={styles.dangerButton} onClick={() => void revoke(trial.id)}>Revoke</button>}
            </div>
          </article>
        ))}
        {!linkedTrials.length && !message && <section className={styles.empty}><span><ShieldCheck size={24}/></span><h2>No trial requests yet</h2><p>New self-serve trial signups will appear here automatically.</p></section>}
      </section>
    </AdminShell>
  )
}
