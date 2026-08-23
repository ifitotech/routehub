'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {getSupabase} from '../../../lib/supabase'
import {useLocale, useThemePreference} from '../../../lib/use-preferences'
import NotificationBell from '../../notification-bell'
import DriverBottomNav from '../driver-bottom-nav'

export default function DriverSettings() {
  const router=useRouter(); const {locale,t,setLocale}=useLocale(); const {theme,setTheme}=useThemePreference(); const [email,setEmail]=useState(''); const [fullName,setFullName]=useState(''); const [phone,setPhone]=useState(''); const [editing,setEditing]=useState(false); const [saving,setSaving]=useState(false); const [message,setMessage]=useState('')
  useEffect(()=>{getSupabase().auth.getUser().then(({data})=>{const user=data.user;setEmail(user?.email||'');setFullName(String(user?.user_metadata?.full_name||user?.user_metadata?.name||''));setPhone(String(user?.user_metadata?.phone||''))})},[])
  const signOut=async()=>{await getSupabase().auth.signOut();router.replace('/');router.refresh()}
  const saveProfile=async()=>{if(saving)return;setSaving(true);const {error}=await getSupabase().auth.updateUser({data:{full_name:fullName.trim(),phone:phone.trim()}});setMessage(error?.message||'Profile updated.');if(!error)setEditing(false);setSaving(false)}
  return <main className="app driver-dashboard settings-page"><header className="topbar"><Link className="brand" href="/driver">ROUTEHUB</Link><NotificationBell/></header><p className="eyebrow">{t.driverWorkspace}</p><h1>{t.settings}</h1><section className="card settings-card"><h2>{t.profile}</h2>{!editing?<><p className="profile-email">{fullName||t.driverAccount}</p><p className="profile-email">{email}</p><p className="profile-email">{phone||'Phone number'}</p></>:<><label>Full name<input value={fullName} onChange={event=>setFullName(event.target.value)} placeholder="Full name"/></label><label>Email<input value={email} readOnly aria-readonly="true"/></label><label>Phone number<input type="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="(000) 000-0000"/></label><button className="primary" disabled={saving} onClick={saveProfile}>{saving?'Saving…':'Save profile'}</button></>}<button className="secondary" onClick={()=>setEditing(value=>!value)}>{editing?'Cancel':t.editProfile}</button>{message&&<p className="muted" role="status">{message}</p>}<button className="danger-outline" onClick={signOut}>{t.logout}</button></section><section className="card settings-card"><h2>{t.preferences}</h2><label>{t.theme}<select value={theme} onChange={event=>setTheme(event.target.value)}><option value="system">{t.system}</option><option value="light">{t.light}</option><option value="dark">{t.dark}</option></select></label><label>{t.language}<select value={locale} onChange={event=>setLocale(event.target.value)}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></label></section><DriverBottomNav/></main>
}
