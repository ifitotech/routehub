'use client'

import {AlertTriangle, Check, ChevronDown, Copy, RotateCcw} from 'lucide-react'
import {useEffect, useMemo, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import AdminShell from '../admin-shell'
import styles from '../admin.module.css'

type ErrorRow = {
  id: string
  action: string
  error_message: string
  context: Record<string, unknown> | null
  created_at: string
  resolved_at: string | null
  company_id: string | null
  user_id: string | null
  companies?: {name: string} | null
  users?: {email: string; name: string | null} | null
}

type Filter = 'open' | 'resolved' | 'all'

// The one thing this screen exists for: let the CEO copy one report and
// paste it straight into a chat with Claude to get it fixed, instead of
// relaying a garbled phone description of what a tester saw.
function formatForCopy(row: ErrorRow) {
  const lines = [
    `Action: ${row.action}`,
    `Message: ${row.error_message}`,
    `Company: ${row.companies?.name || 'Unknown'}`,
    `User: ${row.users?.name || row.users?.email || 'Unknown'}`,
    `When: ${new Date(row.created_at).toLocaleString()}`,
  ]
  if (row.context && Object.keys(row.context).length) lines.push(`Context: ${JSON.stringify(row.context, null, 2)}`)
  return lines.join('\n')
}

export default function AdminErrors() {
  const [rows, setRows] = useState<ErrorRow[]>([])
  const [filter, setFilter] = useState<Filter>('open')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [message, setMessage] = useState('Loading error reports…')

  const load = async () => {
    try {
      const supabase = getSupabase()
      const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Sign in as CEO.')
      const {data: admin} = await supabase.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
      if (!admin) throw new Error('CEO access required.')
      const {data, error} = await supabase.from('app_error_reports').select('id,action,error_message,context,created_at,resolved_at,company_id,user_id,companies(name),users(email,name)').order('created_at', {ascending: false}).limit(200)
      if (error) throw error
      setRows((data || []) as unknown as ErrorRow[])
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load error reports.')
    }
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => rows.filter(row => filter === 'all' || (filter === 'open' ? !row.resolved_at : Boolean(row.resolved_at))), [rows, filter])
  const openCount = rows.filter(row => !row.resolved_at).length

  const copyReport = async (row: ErrorRow) => {
    try {
      await navigator.clipboard.writeText(formatForCopy(row))
      setCopiedId(row.id)
      setTimeout(() => setCopiedId(current => current === row.id ? null : current), 2000)
    } catch { setMessage('Could not copy to clipboard.') }
  }
  const resolve = async (id: string) => {
    const {data: userData} = await getSupabase().auth.getUser()
    const {error} = await getSupabase().from('app_error_reports').update({resolved_at: new Date().toISOString(), resolved_by: userData.user?.id}).eq('id', id)
    setMessage(error ? error.message : '')
    if (!error) await load()
  }
  const reopen = async (id: string) => {
    const {error} = await getSupabase().from('app_error_reports').update({resolved_at: null, resolved_by: null}).eq('id', id)
    setMessage(error ? error.message : '')
    if (!error) await load()
  }

  return (
    <AdminShell active="errors">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CEO / Admin · Reliability</p>
          <h1 className={styles.title}>Errors</h1>
          <p className={styles.subtitle}>Crashes and failures reported automatically from every company&apos;s Manager and Driver app. Copy one and hand it over to get it fixed.</p>
        </div>
      </header>

      <div className={styles.formGrid} style={{gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', alignItems: 'stretch'}}>
        {(['open', 'resolved', 'all'] as Filter[]).map(value => (
          <button key={value} type="button" className={styles.secondaryButton} data-on={filter === value ? 'true' : 'false'} style={filter === value ? {background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)'} : undefined} onClick={() => setFilter(value)}>
            {value === 'open' ? `Open (${openCount})` : value === 'resolved' ? 'Resolved' : 'All'}
          </button>
        ))}
      </div>

      {message && <p className={styles.statusMessage}>{message}</p>}

      <h2 className={styles.sectionLabel}>{filter === 'open' ? 'Open reports' : filter === 'resolved' ? 'Resolved reports' : 'All reports'}</h2>
      <section className={styles.list} aria-label="Error reports">
        {filtered.map(row => {
          const expanded = expandedId === row.id
          return (
            <article key={row.id} className={styles.rowCard} style={{gridTemplateColumns: '48px minmax(0, 1fr) auto', alignItems: 'start'}}>
              <span className={styles.rowIcon} style={row.resolved_at ? undefined : {background: '#fff0f0', color: '#dc2626'}}><AlertTriangle size={20}/></span>
              <div className={styles.identity} style={{overflow: 'visible', whiteSpace: 'normal'}}>
                <h2 style={{whiteSpace: 'normal'}}>{row.action.replaceAll('_', ' ')}</h2>
                <p style={{whiteSpace: 'normal'}}>{row.error_message}</p>
                <p>{row.companies?.name || 'Unknown company'} · {row.users?.name || row.users?.email || 'Unknown user'} · {new Date(row.created_at).toLocaleString()}</p>
                {row.context && Object.keys(row.context).length > 0 && (
                  <>
                    <button type="button" className={styles.secondaryButton} style={{marginTop: 8, minHeight: 34, fontSize: '.76rem'}} onClick={() => setExpandedId(expanded ? null : row.id)}>
                      <ChevronDown size={14} style={{transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform 140ms ease'}}/> {expanded ? 'Hide context' : 'Show context'}
                    </button>
                    {expanded && <pre style={{marginTop: 8, padding: 12, overflowX: 'auto', borderRadius: 10, background: '#0f1d35', color: '#dbe7fa', fontSize: '.76rem', lineHeight: 1.5}}>{JSON.stringify(row.context, null, 2)}</pre>}
                  </>
                )}
              </div>
              <div className={styles.rowAside} style={{flexDirection: 'column', alignItems: 'stretch', gap: 8}}>
                <button type="button" className={styles.secondaryButton} onClick={() => void copyReport(row)}>{copiedId === row.id ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy</>}</button>
                {row.resolved_at
                  ? <button type="button" className={styles.secondaryButton} onClick={() => void reopen(row.id)}><RotateCcw size={14}/> Reopen</button>
                  : <button type="button" className={styles.dangerButton} style={{color: '#067647', borderColor: '#bbf0d0'}} onClick={() => void resolve(row.id)}><Check size={14}/> Resolve</button>}
              </div>
            </article>
          )
        })}
        {!filtered.length && !message && (
          <section className={styles.empty}>
            <span><AlertTriangle size={24}/></span>
            <h2>{filter === 'open' ? 'No open errors' : 'Nothing here'}</h2>
            <p>{filter === 'open' ? 'Every reported crash has been resolved.' : 'No error reports match this filter yet.'}</p>
          </section>
        )}
      </section>
    </AdminShell>
  )
}
