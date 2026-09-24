'use client'

import {Check, Copy, LifeBuoy, RefreshCw, RotateCcw} from 'lucide-react'
import {useEffect, useMemo, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import AdminShell from '../admin-shell'
import styles from '../admin.module.css'

type SupportRow = {
  id: string
  message: string
  created_at: string
  resolved_at: string | null
  company_id: string | null
  user_id: string | null
  companies?: {name: string} | null
  users?: {email: string; name: string | null} | null
}

type Filter = 'open' | 'resolved' | 'all'

function formatForCopy(row: SupportRow) {
  return [
    `Message: ${row.message}`,
    `Company: ${row.companies?.name || 'Unknown company'}`,
    `User: ${row.users?.name || row.users?.email || 'Unknown user'}`,
    `When: ${new Date(row.created_at).toLocaleString()}`,
  ].join('\n')
}

export default function AdminSupport() {
  const [rows, setRows] = useState<SupportRow[]>([])
  const [filter, setFilter] = useState<Filter>('open')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const supabase = getSupabase()
      const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Sign in as CEO.')
      const {data: admin} = await supabase.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
      if (!admin) throw new Error('CEO access required.')
      const {data, error} = await supabase.from('support_requests').select('id,message,created_at,resolved_at,company_id,user_id,companies(name),users(email,name)').order('created_at', {ascending: false}).limit(200)
      if (error) throw error
      setRows((data || []) as unknown as SupportRow[])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load support requests.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => rows.filter(row => filter === 'all' || (filter === 'open' ? !row.resolved_at : Boolean(row.resolved_at))), [rows, filter])
  const openCount = rows.filter(row => !row.resolved_at).length

  const copyRequest = async (row: SupportRow) => {
    try {
      await navigator.clipboard.writeText(formatForCopy(row))
      setCopiedId(row.id)
      setTimeout(() => setCopiedId(current => current === row.id ? null : current), 2000)
    } catch {
      setMessage('Could not copy to clipboard.')
    }
  }

  const resolve = async (id: string) => {
    if (busyId) return
    setBusyId(id)
    const {data: userData} = await getSupabase().auth.getUser()
    const {error} = await getSupabase().from('support_requests').update({resolved_at: new Date().toISOString(), resolved_by: userData.user?.id}).eq('id', id)
    if (error) setMessage(error.message)
    else { await load(); setMessage('Support request marked as resolved.') }
    setBusyId(null)
  }
  const reopen = async (id: string) => {
    if (busyId) return
    setBusyId(id)
    const {error} = await getSupabase().from('support_requests').update({resolved_at: null, resolved_by: null}).eq('id', id)
    if (error) setMessage(error.message)
    else { await load(); setMessage('Support request reopened.') }
    setBusyId(null)
  }

  return (
    <AdminShell active="support">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CEO / Admin · Support</p>
          <h1 className={styles.title}>Support</h1>
          <p className={styles.subtitle}>Requests Managers and Drivers send from Settings &gt; Contact support.</p>
        </div>
        <button className={styles.refreshButton} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? styles.spinning : undefined}/>{loading ? 'Updating…' : 'Refresh'}</button>
      </header>

      {loadError ? <section className={styles.loadError} role="alert"><LifeBuoy size={19}/><div><strong>Support requests could not be refreshed.</strong><p>{loadError}</p></div><button className={styles.secondaryButton} type="button" onClick={() => void load()}>Try again</button></section> : loading ? <section className={styles.empty} aria-live="polite"><span><RefreshCw className={styles.spinning} size={24}/></span><h2>Loading support requests…</h2><p>Checking the latest requests from Driver and Manager.</p></section> : <>

      <div className={styles.formGrid} style={{gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', alignItems: 'stretch'}}>
        {(['open', 'resolved', 'all'] as Filter[]).map(value => (
          <button key={value} type="button" className={styles.secondaryButton} style={filter === value ? {background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)'} : undefined} onClick={() => setFilter(value)}>
            {value === 'open' ? `Open (${openCount})` : value === 'resolved' ? 'Resolved' : 'All'}
          </button>
        ))}
      </div>

      {message && <p className={styles.statusMessage}>{message}</p>}

      <h2 className={styles.sectionLabel}>{filter === 'open' ? 'Open requests' : filter === 'resolved' ? 'Resolved requests' : 'All requests'}</h2>
      <section className={styles.list} aria-label="Support requests">
        {filtered.map(row => (
          <article key={row.id} className={styles.rowCard} style={{gridTemplateColumns: '48px minmax(0, 1fr) auto', alignItems: 'start'}}>
            <span className={styles.rowIcon} style={row.resolved_at ? undefined : {background: '#fff7e8', color: '#b45309'}}><LifeBuoy size={20}/></span>
            <div className={styles.identity} style={{overflow: 'visible', whiteSpace: 'normal'}}>
              <h2 style={{whiteSpace: 'normal'}}>{row.message}</h2>
              <p>{row.companies?.name || 'Unknown company'} · {row.users?.name || row.users?.email || 'Unknown user'} · {new Date(row.created_at).toLocaleString()}</p>
            </div>
            <div className={styles.rowAside} style={{flexDirection: 'column', alignItems: 'stretch', gap: 8}}>
              <button type="button" className={styles.secondaryButton} onClick={() => void copyRequest(row)}>{copiedId === row.id ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy</>}</button>
              {row.resolved_at
                ? <button type="button" className={styles.secondaryButton} disabled={busyId === row.id} onClick={() => void reopen(row.id)}><RotateCcw size={14}/> {busyId === row.id ? 'Saving…' : 'Reopen'}</button>
                : <button type="button" className={styles.dangerButton} disabled={busyId === row.id} style={{color: '#067647', borderColor: '#bbf0d0'}} onClick={() => void resolve(row.id)}><Check size={14}/> {busyId === row.id ? 'Saving…' : 'Resolve'}</button>}
            </div>
          </article>
        ))}
        {!filtered.length && !message && (
          <section className={styles.empty}>
            <span><LifeBuoy size={24}/></span>
            <h2>{filter === 'open' ? 'No open requests' : 'Nothing here'}</h2>
            <p>{filter === 'open' ? 'Every support request has been handled.' : 'No support requests match this filter yet.'}</p>
          </section>
        )}
      </section>
      </>}
    </AdminShell>
  )
}
