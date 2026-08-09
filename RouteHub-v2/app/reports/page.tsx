'use client'

import Link from 'next/link'
import {useEffect, useMemo, useState} from 'react'
import {Download, Printer} from 'lucide-react'
import {currentAccess} from '../../lib/data'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'

type Activity = {id:string; action:string; created_at:string; user_id:string; record_id?:string; after_value?:Record<string,any>}
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`
const actionCopy = {
  en:{route_created:'Route created',route_updated:'Route updated',route_started:'Route started',route_paused:'Route paused',routes_reordered:'Routes reordered',delivery_completed:'Delivery completed'},
  es:{route_created:'Ruta creada',route_updated:'Ruta actualizada',route_started:'Ruta iniciada',route_paused:'Ruta pausada',routes_reordered:'Rutas reordenadas',delivery_completed:'Entrega completada'},
  fr:{route_created:'Itinéraire créé',route_updated:'Itinéraire mis à jour',route_started:'Itinéraire commencé',route_paused:'Itinéraire en pause',routes_reordered:'Itinéraires réorganisés',delivery_completed:'Livraison terminée'},
} as const

export default function Reports() {
  const {locale, t} = useLocale()
  const [rows, setRows] = useState<Activity[]>([])
  const [people, setPeople] = useState<Record<string,string>>({})
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { (async () => { try { setMessage(t.loadingActivity); const access = await currentAccess(); const client = getSupabase(); let query = client.from('activity_logs').select('id,action,created_at,user_id,record_id,after_value').order('created_at', {ascending:false}).limit(100); if (access.membership?.company_id) query = query.eq('company_id', access.membership.company_id); const {data, error} = await query; if (error) throw error; setRows((data || []) as Activity[]); if (access.membership?.company_id) { const {data: members} = await client.from('company_users').select('user_id,users(email)').eq('company_id', access.membership.company_id); const labels:Record<string,string> = {}; (members || []).forEach((member:any) => { labels[member.user_id] = member.users?.email || t.teamMemberLabel }); setPeople(labels) } setMessage('') } catch (error) { setMessage(error instanceof Error ? error.message : t.unableLoadReports) } })() }, [locale, t.loadingActivity, t.teamMemberLabel, t.unableLoadReports])
  const filtered = useMemo(() => rows.filter(row => (!from || row.created_at.slice(0,10) >= from) && (!to || row.created_at.slice(0,10) <= to)), [rows,from,to])
  const actionLabel = (action:string) => actionCopy[locale][action as keyof typeof actionCopy.en] || action.replaceAll('_',' ')
  const exportCsv = () => { const content = [[t.action,t.teamMemberLabel,t.createdAt,t.record], ...filtered.map(row => [actionLabel(row.action), people[row.user_id] || t.teamMemberLabel, row.created_at, row.record_id || ''])].map(line => line.map(csvCell).join(',')).join('\n'); const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([content], {type:'text/csv'})); link.href=url; link.download='routehub-report.csv'; link.click(); URL.revokeObjectURL(url) }
  return <main className="app reports-page"><header className="topbar"><Link className="brand" href="/">ROUTEHUB</Link><div className="actions"><button className="secondary" onClick={() => window.print()}><Printer size={17}/>{t.printPdf}</button><button className="secondary" onClick={exportCsv}><Download size={17}/>CSV</button></div></header><p className="eyebrow">{t.operations.toUpperCase()}</p><h1>{t.reports}</h1><p className="muted">{t.reportsHelp}</p><section className="card report-filters"><label>{t.from}<input type="date" value={from} onChange={event => setFrom(event.target.value)}/></label><label>{t.to}<input type="date" value={to} onChange={event => setTo(event.target.value)}/></label></section>{message && <p className="muted" role="status">{message}</p>}<div className="report-count"><strong>{filtered.length}</strong><span>{t.activityRecords}</span></div><section className="report-list">{filtered.map(row => { const meta=row.after_value || {}; return <article className="card report-row" key={row.id}><div><strong>{actionLabel(row.action)}</strong><p className="muted">{new Date(row.created_at).toLocaleString(locale)} · {people[row.user_id] || t.teamMemberLabel}</p>{row.action === 'delivery_completed' && <p className="muted">{t.completion}: {meta.method || t.manual}{meta.location?.accuracy != null ? ` · ${t.gpsAccuracy} ${Math.round(meta.location.accuracy)} m` : ''}</p>}</div></article> })}{!filtered.length && !message && <section className="card driver-empty"><h2>{t.noActivity}</h2><p className="muted">{t.noActivityHelp}</p></section>}</section></main>
}
