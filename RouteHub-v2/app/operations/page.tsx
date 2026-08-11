'use client'
import Link from 'next/link'
import {BarChart3, Plus, Route, Settings} from 'lucide-react'
import {useLocale} from '../../lib/use-preferences'
import NotificationBell from '../notification-bell'

export default function Operations(){const{t}=useLocale();return <main className="app role-dashboard"><header className="topbar"><Link className="brand" href="/">ROUTEHUB</Link><NotificationBell /></header><p className="eyebrow">{t.operationsManager.toUpperCase()}</p><h1>{t.dispatchOperations}</h1><p className="muted">{t.operationsHelp}</p><section className="manager-panel"><div className="section-heading"><div><h2>{t.quickActions}</h2><p className="muted">{t.dailyDispatch}</p></div></div><div className="quick-grid"><Link className="quick-action primary" href="/routes/manage"><Route size={20}/>{t.manageRoutes}</Link><Link className="quick-action" href="/routes"><Plus size={20}/>{t.addRoute}</Link><Link className="quick-action" href="/reports"><BarChart3 size={20}/>{t.reports}</Link><Link className="quick-action" href="/settings"><Settings size={20}/>{t.settings}</Link></div></section><nav className="nav"><Link href="/operations">{t.home}</Link><Link href="/routes">{t.routes}</Link><Link href="/reports">{t.reports}</Link><Link href="/settings">{t.settings}</Link></nav></main>}
