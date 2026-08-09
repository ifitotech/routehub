'use client'

import Link from 'next/link'
import {useCallback, useEffect, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'

type RequestItem = {id:string; type:string; customer:string; address:string; priority:string; status:string}

export default function Requests() {
  const {t} = useLocale()
  const [items, setItems] = useState<RequestItem[]>([])
  const [tab, setTab] = useState('pending')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({type:'pickup', customer:'', address:'', priority:'normal'})
  const load = useCallback(async () => { try { const client = getSupabase(); const {data: userData} = await client.auth.getUser(); if (!userData.user) throw Error(t.signIn); const {data: membership} = await client.from('company_users').select('company_id').eq('user_id', userData.user.id).limit(1).maybeSingle(); if (!membership) throw Error(t.noMembership); const {data, error} = await client.from('requests').select('id,type,customer,address,priority,status').eq('company_id', membership.company_id).order('created_at', {ascending:false}); if (error) throw error; setItems(data || []) } catch (error) { setMessage(error instanceof Error ? error.message : t.unableLoadRequests) } }, [t.signIn, t.noMembership, t.unableLoadRequests])
  useEffect(() => { void load() }, [load])
  const save = async () => { if (!form.customer || !form.address) return; try { const client = getSupabase(); const {data: userData} = await client.auth.getUser(); if (!userData.user) throw Error(t.signInFirst); const {data: membership} = await client.from('company_users').select('company_id,branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle(); if (!membership) throw Error(t.noMembership); const {error} = await client.from('requests').insert({...form, company_id:membership.company_id, branch_id:membership.branch_id, created_by:userData.user.id, status:'pending'}); if (error) throw error; setMessage(t.requestSaved); setOpen(false); setForm({type:'pickup',customer:'',address:'',priority:'normal'}); await load() } catch (error) { setMessage(error instanceof Error ? error.message : t.unableSaveRequest) } }
  const visibleItems = items.filter(item => item.status === tab)
  const statusLabel = (status:string) => status === 'pending' ? t.pending : status === 'assigned' ? t.assigned : status === 'completed' ? t.completed : t.cancelled
  const typeLabel = (type:string) => type === 'pickup' ? t.pickup : t.delivery
  return <main className="app requests-page"><header className="topbar"><Link className="brand" href="/">ROUTEHUB</Link><button className="primary" onClick={() => setOpen(true)}>{t.newRequest}</button></header><p className="eyebrow">{t.operations.toUpperCase()}</p><h1>{t.requests}</h1><p className="muted">{t.requestsHelp}</p><div className="request-tabs" role="tablist">{['pending','assigned','completed','cancelled'].map(status => <button className={tab === status ? 'primary' : 'secondary'} role="tab" aria-selected={tab === status} key={status} onClick={() => setTab(status)}>{statusLabel(status)}</button>)}</div>
    {open && <section className="card compact-form"><div className="form-title"><h2>{t.newRequestTitle}</h2><button className="close" aria-label={t.close} onClick={() => setOpen(false)}>×</button></div><label>{t.type}<select value={form.type} onChange={event => setForm({...form,type:event.target.value})}><option value="pickup">{t.pickup}</option><option value="delivery">{t.delivery}</option></select></label><label>{t.customerSupplier}<input value={form.customer} onChange={event => setForm({...form,customer:event.target.value})}/></label><label>{t.address}<input value={form.address} onChange={event => setForm({...form,address:event.target.value})}/></label><label>{t.priorityLabel}<select value={form.priority} onChange={event => setForm({...form,priority:event.target.value})}><option value="normal">{t.normal}</option><option value="priority">{t.priority}</option><option value="urgent">{t.urgent}</option></select></label><div className="actions"><button className="primary" onClick={save}>{t.saveRequest}</button><button className="secondary" onClick={() => setOpen(false)}>{t.cancel}</button></div></section>}
    <section className="request-list">{visibleItems.map(item => <article className={`card request-card priority-${item.priority}`} key={item.id}><small>{typeLabel(item.type).toUpperCase()} · {(item.priority === 'urgent' ? t.urgent : item.priority === 'priority' ? t.priority : t.normal).toUpperCase()}</small><h2>{item.customer}</h2><p className="muted">{item.address}</p></article>)}{!visibleItems.length && <section className="card"><h2>{t.noRequestsPrefix} {statusLabel(tab).toLowerCase()} {t.noRequestsSuffix}</h2><p className="muted">{t.requestsAppear}</p></section>}</section>{message && <p className="muted" role="status">{message}</p>}
  </main>
}
