'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import NotificationBell from '../../notification-bell'
import DriverBottomNav from '../driver-bottom-nav'
import DeviceNotificationsSetting from '../../device-notifications-setting'

export default function DriverSettings() {
  const router=useRouter(); const {locale,t,setLocale}=useLocale(); const [email,setEmail]=useState(''); const [fullName,setFullName]=useState(''); const [phone,setPhone]=useState(''); const [editing,setEditing]=useState(false); const [saving,setSaving]=useState(false); const [message,setMessage]=useState('')
  const copy=locale==='es'?{phone:'Teléfono',fullName:'Nombre completo',save:'Guardar perfil',saving:'Guardando…',cancel:'Cancelar',updated:'Perfil actualizado.'}:locale==='fr'?{phone:'Téléphone',fullName:'Nom complet',save:'Enregistrer le profil',saving:'Enregistrement…',cancel:'Annuler',updated:'Profil mis à jour.'}:{phone:'Phone number',fullName:'Full name',save:'Save profile',saving:'Saving…',cancel:'Cancel',updated:'Profile updated.'}
  useEffect(()=>{getSupabase().auth.getUser().then(({data})=>{const user=data.user;setEmail(user?.email||'');setFullName(String(user?.user_metadata?.full_name||user?.user_metadata?.name||''));setPhone(String(user?.user_metadata?.phone||''))})},[])
  const signOut=async()=>{await getSupabase().auth.signOut();router.replace('/');router.refresh()}
  const saveProfile=async()=>{if(saving)return;setSaving(true);const client=getSupabase();const {data:authData,error}=await client.auth.updateUser({data:{full_name:fullName.trim(),phone:phone.trim()}});if(!error&&authData.user){await client.from('users').update({name:fullName.trim(),email:authData.user.email||email}).eq('id',authData.user.id)}setMessage(error?.message||copy.updated);if(!error)setEditing(false);setSaving(false)}
  return <main className="app driver-dashboard settings-page"><header className="topbar"><Link className="brand" href="/driver">ROUTEHUB</Link><NotificationBell/></header><p className="eyebrow">{t.driverWorkspace}</p><h1>{t.settings}</h1><section className="card settings-card"><h2>{t.profile}</h2>{!editing?<><p className="profile-email">{fullName||t.driverAccount}</p><p className="profile-email">{email}</p><p className="profile-email">{phone||copy.phone}</p></>:<><label>{copy.fullName}<input value={fullName} onChange={event=>setFullName(event.target.value)} placeholder={copy.fullName}/></label><label>Email<input value={email} readOnly aria-readonly="true"/></label><label>{copy.phone}<input type="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="(000) 000-0000"/></label><button className="primary" disabled={saving} onClick={saveProfile}>{saving?copy.saving:copy.save}</button></>}<button className="secondary" onClick={()=>setEditing(value=>!value)}>{editing?copy.cancel:t.editProfile}</button>{message&&<p className="muted" role="status">{message}</p>}<button className="danger-outline" onClick={signOut}>{t.logout}</button></section><section className="card settings-card"><h2>{t.preferences}</h2><label>{t.language}<select value={locale} onChange={event=>setLocale(event.target.value)}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></label></section><DeviceNotificationsSetting/><DriverBottomNav/></main>
}
