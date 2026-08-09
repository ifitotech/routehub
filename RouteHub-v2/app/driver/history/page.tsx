'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'

type RouteRecord = {id:string; status:string; destination_name?:string; destination_address?:string; completed_at?:string; completion_method?:string; notes?:string}

export default function History() {
  const [rows, setRows] = useState<RouteRecord[]>([])
  const [message, setMessage] = useState('')
  const {locale, t} = useLocale()
  useEffect(() => {
    ;(async () => { try { const client = getSupabase(); const {data: userData} = await client.auth.getUser(); if (!userData.user) throw Error(t.signIn); const {data, error} = await client.from('routes').select('id,status,destination_name,destination_address,completed_at,completion_method,notes').eq('driver_id', userData.user.id).in('status', ['completed','issue','cancelled']).order('completed_at', {ascending:false}); if (error) throw error; setRows(data || []) } catch (error) { setMessage(error instanceof Error ? error.message : t.unableLoadRoutes) } })()
  }, [t.signIn, t.unableLoadRoutes])
  return <main className="app driver-dashboard"><header className="topbar"><Link className="brand" href="/driver">ROUTEHUB</Link><div className="avatar">DR</div></header><p className="eyebrow">{t.driverWorkspace}</p><h1>{t.completedRoutes}</h1>{message && <p className="muted" role="status">{message}</p>}<section className="history-grid">{rows.map(route => <article className={`card history-card history-${route.status}`} key={route.id}><div className="history-heading"><strong>{route.status === 'completed' ? t.completed : route.status === 'issue' ? t.issueReported : t.notCompleted}</strong><span>{route.status === 'completed' ? t.completed : route.status === 'issue' ? t.issues : t.cancelled}</span></div><h2>{route.destination_name || route.destination_address || t.routes}</h2><p className="muted">{route.completed_at ? new Date(route.completed_at).toLocaleString(locale) : t.completionTime} · {route.completion_method || t.notRecorded}</p>{route.notes && <p>{route.notes}</p>}</article>)}{!rows.length && !message && <section className="card driver-empty"><h2>{t.noHistory}</h2><p className="muted">{t.historyHelp}</p></section>}</section><nav className="nav"><Link href="/driver">{t.home}</Link><Link href="/driver/history">{t.history}</Link><Link href="/driver/settings">{t.settings}</Link></nav></main>
}
