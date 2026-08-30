'use client'
import Link from 'next/link'
import {
  CalendarDays,
  Fuel,
  HelpCircle,
  History,
  LogOut,
  Settings,
  Wrench,
} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useState} from 'react'

export default function DriverV3More() {
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    await getSupabase().auth.signOut()
    window.location.assign('/login')
  }

  return (
    <DriverV3Shell active="more">
      <p className="eyebrow">QUICK TOOLS</p>
      <h1 className="title">More</h1>

      <section className="card">
        <div className="row">
          <Link href="/driver/history" style={{display: 'flex', alignItems: 'center', gap: 12, flex: 1, textDecoration: 'none', color: 'inherit'}}>
            <History size={20} color="#667892" />
            <span>Route History</span>
          </Link>
        </div>
        <div className="row">
          <Link href="/driver/driving-day" style={{display: 'flex', alignItems: 'center', gap: 12, flex: 1, textDecoration: 'none', color: 'inherit'}}>
            <CalendarDays size={20} color="#667892" />
            <span>Driving Day</span>
          </Link>
        </div>
        <div className="row">
          <Link href="/driver/truck/fuel" style={{display: 'flex', alignItems: 'center', gap: 12, flex: 1, textDecoration: 'none', color: 'inherit'}}>
            <Fuel size={20} color="#667892" />
            <span>Truck Fuel</span>
          </Link>
        </div>
        <div className="row">
          <Link href="/driver/truck/maintenance" style={{display: 'flex', alignItems: 'center', gap: 12, flex: 1, textDecoration: 'none', color: 'inherit'}}>
            <Wrench size={20} color="#667892" />
            <span>Truck Maintenance</span>
          </Link>
        </div>
        <div className="row">
          <Link href="/driver/settings" style={{display: 'flex', alignItems: 'center', gap: 12, flex: 1, textDecoration: 'none', color: 'inherit'}}>
            <Settings size={20} color="#667892" />
            <span>Settings</span>
          </Link>
        </div>
        <div className="row">
          <Link href="/settings/contact" style={{display: 'flex', alignItems: 'center', gap: 12, flex: 1, textDecoration: 'none', color: 'inherit'}}>
            <HelpCircle size={20} color="#667892" />
            <span>Help</span>
          </Link>
        </div>
      </section>

      <section className="card" style={{marginTop: 12}}>
        <button
          className="danger"
          disabled={busy}
          onClick={() => void signOut()}
          style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8}}
        >
          <LogOut size={18} />
          {busy ? 'Signing out…' : 'Log Out'}
        </button>
      </section>
    </DriverV3Shell>
  )
}
