'use client'
import {useEffect, useState} from 'react'
import {Edit3, LogOut, Mail, Phone, UserRound} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useLocale} from '../../../lib/use-preferences'

export default function DriverProfile() {
  const {t, locale} = useLocale()
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  useEffect(() => {
    void getSupabase().auth.getUser().then(({data}) => {
      const user = data.user
      setEmail(user?.email || '')
      setFullName(String(user?.user_metadata?.full_name || user?.user_metadata?.name || ''))
      setPhone(String(user?.user_metadata?.phone || ''))
    })
  }, [])

  const saveProfile = async () => {
    if (saving) return
    setSaving(true)
    const client = getSupabase()
    const {data: authData, error} = await client.auth.updateUser({data: {full_name: fullName.trim(), phone: phone.trim()}})
    if (!error && authData.user) {
      await client.from('users').update({name: fullName.trim(), email: authData.user.email || email}).eq('id', authData.user.id)
    }
    setProfileMsg(error?.message || t.drvSaveProfile)
    if (!error) setEditing(false)
    setSaving(false)
  }

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    await getSupabase().auth.signOut()
    window.location.assign('/login')
  }

  return (
    <DriverV3Shell active="more" title={t.drvProfile}>
      <section className="card driver-profile-hero">
        <div className="driver-profile-avatar" aria-hidden="true">{(fullName || email || 'RH').split(/\s+|@/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</div>
        <p className="eyebrow">{t.drvProfile}</p>
        {!editing ? (
          <>
            <h2 style={{margin: '4px 0 8px', fontSize: 24}}>{fullName || 'RouteHub Driver'}</h2>
            <p className="muted driver-profile-line"><Mail size={16}/>{email}</p>
            <p className="muted driver-profile-line"><Phone size={16}/>{phone || t.drvPhone}</p>
          </>
        ) : (
          <>
            <label>
              {t.drvFullName}
              <input value={fullName} onChange={e => setFullName(e.target.value)} />
            </label>
            <label>
              {locale === 'es' ? 'Correo' : locale === 'fr' ? 'E-mail' : 'Email'}
              <input value={email} readOnly />
            </label>
            <label>
              {t.drvPhone}
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </label>
            <button type="button" className="primary" disabled={saving} onClick={() => void saveProfile()}>
              {saving ? t.drvSaving : t.drvSaveProfile}
            </button>
          </>
        )}
        <button type="button" className="secondary" style={{marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center'}} onClick={() => setEditing(v => !v)}>
          {editing ? null : <Edit3 size={17}/>} {editing ? t.drvCancel : t.drvEditProfile}
        </button>
        {profileMsg && <p className="muted" role="status">{profileMsg}</p>}
      </section>

      <section className="card" style={{marginTop: 12}}>
        <div className="driver-profile-account"><UserRound size={18}/><span>{locale === 'es' ? 'Cuenta del conductor' : locale === 'fr' ? 'Compte conducteur' : 'Driver account'}</span></div>
        <button
          className="danger"
          disabled={busy}
          onClick={() => void signOut()}
          style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, minHeight: 52}}
        >
          <LogOut size={18} />
          {busy ? t.drvSigningOut : t.drvSignOut}
        </button>
      </section>
    </DriverV3Shell>
  )
}
