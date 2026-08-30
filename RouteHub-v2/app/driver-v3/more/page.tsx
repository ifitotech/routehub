'use client'
import Link from 'next/link'
import {
  CalendarDays,
  ChevronRight,
  HelpCircle,
  History,
  LogOut,
  Settings,
} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useState} from 'react'

function Row({href, icon: Icon, label}: {href: string; icon: typeof History; label: string}) {
  return (
    <Link
      href={href}
      className="row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textDecoration: 'none',
        color: 'inherit',
        minHeight: 56,
        padding: '4px 0',
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: '#F2F6FB',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} color="#667892" />
      </span>
      <span style={{flex: 1, fontWeight: 700, fontSize: 16}}>{label}</span>
      <ChevronRight size={18} color="#8A97A8" />
    </Link>
  )
}

export default function DriverV3More() {
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    await getSupabase().auth.signOut()
    window.location.assign('/login')
  }

  return (
    <DriverV3Shell active="more" title="More">

      <section className="card">
        <p className="eyebrow" style={{marginBottom: 4}}>
          WORK
        </p>
        <Row href="/driver/history" icon={History} label="Route History" />
        <Row href="/driver/driving-day" icon={CalendarDays} label="Driving Day" />
      </section>

      <section className="card" style={{marginTop: 12}}>
        <p className="eyebrow" style={{marginBottom: 4}}>
          ACCOUNT
        </p>
        <Row href="/driver/settings" icon={Settings} label="Settings" />
        <Row href="/settings/contact" icon={HelpCircle} label="Help" />
      </section>

      <section className="card" style={{marginTop: 12}}>
        <button
          className="danger"
          disabled={busy}
          onClick={() => void signOut()}
          style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56}}
        >
          <LogOut size={18} />
          {busy ? 'Signing out…' : 'Log Out'}
        </button>
      </section>
    </DriverV3Shell>
  )
}
