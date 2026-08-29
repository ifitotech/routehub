'use client'
import Link from 'next/link'
import {ClipboardPlus, Settings, Users} from 'lucide-react'
import {useLocale} from '../../lib/use-preferences'
import TemporaryRouteAssignments from '../temporary-route-assignments'

export default function Counter(){const{t}=useLocale();return <main className="app role-dashboard"><header className="topbar"><Link className="brand" href="/">ROUTEHUB</Link></header><p className="eyebrow">{t.counterSales.toUpperCase()}</p><h1>{t.frontDesk}</h1><p className="muted">{t.counterHelp}</p><TemporaryRouteAssignments/><section className="manager-panel"><div className="quick-grid quick-grid-compact"><Link className="quick-action primary" href="/requests"><ClipboardPlus size={20}/>{t.newRequest}</Link><Link className="quick-action" href="/contacts"><Users size={20}/>{t.contacts}</Link><Link className="quick-action" href="/settings"><Settings size={20}/>{t.settings}</Link></div></section><nav className="nav"><Link href="/counter">{t.home}</Link><Link href="/requests">{t.requests}</Link><Link href="/contacts">{t.contacts}</Link><Link href="/settings">{t.settings}</Link></nav></main>}
