'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {Building2, Camera, Save, Sparkles} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'
import GoogleAddressInput from '../google-address-input'
import DeviceNotificationsSetting from '../device-notifications-setting'
import InstallAppCard from '../install-app-card'
import {requestOnboardingReplay} from '../../lib/onboarding'
import ManagerShell from '../manager/manager-shell'
import {sanitizeCoordinate, type MapPoint} from '../../lib/maps/coordinates'
import styles from './settings.module.css'

type BranchSettings = {id: string; name: string; address: string; phone: string; coordinate: MapPoint | null}

export default function Settings() {
  const {locale, t, setLocale} = useLocale()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [branch, setBranch] = useState<BranchSettings>()
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingBranch, setEditingBranch] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [branchSaving, setBranchSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [plan, setPlan] = useState('free')
  const [trialEnd, setTrialEnd] = useState<string | null>(null)
  const [isCeo, setIsCeo] = useState(false)
  const copy = locale === 'es'
    ? {name:'Nombre completo', phone:'Teléfono', photo:'Cambiar foto', edit:'Editar', save:'Guardar perfil', profileSaved:'Perfil actualizado.', branch:'Sucursal principal', branchName:'Nombre de la sucursal', branchAddress:'Dirección de la sucursal', branchPhone:'Teléfono de la sucursal', saveBranch:'Guardar sucursal', branchSaved:'Sucursal actualizada.', noBranch:'No hay una sucursal asignada.', tour:'Recorrido de la app', tourHelp:'Vuelve a ver la guía rápida de RouteHub.', tourAction:'Ver recorrido'}
    : locale === 'fr'
      ? {name:'Nom complet', phone:'Téléphone', photo:'Changer la photo', edit:'Modifier', save:'Enregistrer le profil', profileSaved:'Profil mis à jour.', branch:'Succursale principale', branchName:'Nom de la succursale', branchAddress:'Adresse de la succursale', branchPhone:'Téléphone de la succursale', saveBranch:'Enregistrer la succursale', branchSaved:'Succursale mise à jour.', noBranch:'Aucune succursale associée.', tour:'Visite de l’application', tourHelp:'Revoir le guide rapide de RouteHub.', tourAction:'Voir la visite'}
      : {name:'Full name', phone:'Phone number', photo:'Change photo', edit:'Edit', save:'Save profile', profileSaved:'Profile updated.', branch:'Primary branch', branchName:'Branch name', branchAddress:'Branch address', branchPhone:'Branch phone number', saveBranch:'Save branch', branchSaved:'Branch updated.', noBranch:'No branch assigned.', tour:'App tour', tourHelp:'See the RouteHub quick guide again.', tourAction:'View tour'}

  useEffect(() => {
    let active = true
    const loadSettings = async () => {
      const client = getSupabase(); const {data: userData} = await client.auth.getUser()
      const user = userData.user
      if (!active) return
      setEmail(user?.email || '')
      setFullName(user?.user_metadata?.full_name || user?.user_metadata?.name || '')
      setPhone(user?.user_metadata?.phone || '')
      setAvatarUrl(user?.user_metadata?.avatar_url || '')
      if (!user) return
      const {data: admin} = await client.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
      setIsCeo(Boolean(admin))
      const {data: membership} = await client.from('company_users').select('company_id,branch_id').eq('user_id', user.id).limit(1).maybeSingle()
      if (!membership) return
      const {data: company} = await client.from('companies').select('plan,trial_ends_at').eq('id', membership.company_id).maybeSingle()
      if (company) { setPlan(company.plan || 'free'); setTrialEnd(company.trial_ends_at || null) }
      const branchQuery = membership.branch_id
        ? client.from('branches').select('id,name,address,phone,latitude,longitude').eq('id', membership.branch_id).maybeSingle()
        : client.from('branches').select('id,name,address,phone,latitude,longitude').eq('company_id', membership.company_id).order('name').limit(1).maybeSingle()
      const {data: branchData} = await branchQuery
      if (branchData) setBranch({
        id: branchData.id,
        name: branchData.name || '',
        address: branchData.address || '',
        phone: branchData.phone || '',
        // Legacy branch rows may have coordinates in [lng, lat] order. Keep
        // Settings and Add Route on the same canonical {lat, lng} contract.
        coordinate: sanitizeCoordinate({lat: branchData.latitude, lng: branchData.longitude}),
      })
    }
    void loadSettings()
    // iOS/Safari can restore a cached route after returning from Team. Reload
    // the current user and branch instead of leaving Settings partially empty.
    const onPageShow = () => { if (active) void loadSettings() }
    window.addEventListener('pageshow', onPageShow)
    return () => { active = false; window.removeEventListener('pageshow', onPageShow) }
  }, [])

  const signOut = async () => { await getSupabase().auth.signOut(); window.location.assign('/') }
  const saveProfile = async () => {
    setProfileSaving(true)
    const {error} = await getSupabase().auth.updateUser({data: {full_name: fullName.trim(), phone: phone.trim(), avatar_url: avatarUrl || null}})
    setMessage(error ? error.message : copy.profileSaved)
    setProfileSaving(false)
  }
  const choosePhoto = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setAvatarUrl(reader.result) }
    reader.readAsDataURL(file)
  }
  const saveBranch = async () => {
    if (!branch || branchSaving) return
    setBranchSaving(true)
    const coordinate = branch.coordinate
    const {error} = await getSupabase().from('branches').update({
      name: branch.name.trim(),
      address: branch.address.trim() || null,
      phone: branch.phone.trim() || null,
      // A changed free-text address must never retain a previous branch pin.
      // A Google place selection always provides both values together.
      latitude: coordinate?.lat ?? null,
      longitude: coordinate?.lng ?? null,
    }).eq('id', branch.id)
    setMessage(error ? error.message : copy.branchSaved)
    setBranchSaving(false)
  }

  const userInitials = (fullName || email || 'U').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U'
 return <ManagerShell active="settings" roleLabel={t.managerRole}><div className={`app settings-page ${styles.page}`}><p className="eyebrow">{t.account.toUpperCase()}</p><h1>{t.settings}</h1>
    <section className="card settings-card"><div className="settings-card-heading"><h2>{t.profile}</h2><button className="secondary edit-button" type="button" onClick={() => setEditingProfile(value => !value)}>{copy.edit}</button></div><div className="profile-summary"><div className="profile-avatar">{avatarUrl ? <img src={avatarUrl} alt=""/> : <span>{(fullName || email || 'U').slice(0, 2).toUpperCase()}</span>}</div><div><strong>{fullName || t.profile}</strong><p className="muted">{phone || copy.phone}</p></div></div>{editingProfile && <div className="settings-edit-panel"><label className="secondary photo-picker"><Camera size={17}/>{copy.photo}<input type="file" accept="image/*" onChange={event => choosePhoto(event.target.files?.[0])}/></label><label>{copy.name}<input value={fullName} onChange={event => setFullName(event.target.value)} placeholder={copy.name}/></label><label>{t.signedInEmail}<input value={email} readOnly/></label><label>{copy.phone}<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="(000) 000-0000"/></label><button className="primary" disabled={profileSaving} onClick={saveProfile}><Save size={17}/>{profileSaving ? t.saving : copy.save}</button></div>}<button className="secondary" onClick={signOut}>{t.logout}</button></section>
    {!isCeo && <section className="card settings-card"><div className="settings-card-heading"><h2><Building2 size={19}/> {copy.branch}</h2>{branch && <button className="secondary edit-button" type="button" onClick={() => setEditingBranch(value => !value)}>{copy.edit}</button>}</div>{branch ? <>{!editingBranch ? <div className="branch-summary"><strong>{branch.name || copy.branchName}</strong><p className="muted">{branch.address || t.addressNotConfigured}</p><p className="muted">{branch.phone || copy.branchPhone}</p></div> : <div className="settings-edit-panel"><label>{copy.branchName}<input value={branch.name} onChange={event => setBranch({...branch, name: event.target.value})}/></label><label>{copy.branchAddress}<GoogleAddressInput value={branch.address} autoComplete="street-address" onValueChange={value => setBranch(current => current ? {...current,address:value,coordinate:null} : current)} onSelectSearchSuggestion={suggestion => setBranch(current => current ? {...current,address:suggestion.label,coordinate:sanitizeCoordinate(suggestion.coordinate)} : current)} placeholder={t.addressPlaceholder}/></label><label>{copy.branchPhone}<input type="tel" value={branch.phone} onChange={event => setBranch({...branch, phone: event.target.value})} placeholder="(000) 000-0000"/></label><button className="primary" disabled={branchSaving} onClick={saveBranch}><Save size={17}/>{branchSaving ? t.saving : copy.saveBranch}</button></div>}<Link className="secondary" href="/manager/branches">{t.branches}</Link></> : <p className="muted">{copy.noBranch}</p>}</section>}
    {isCeo && <section className="card settings-card"><h2>Platform access</h2><div className="branch-summary"><strong>CEO / Platform administrator</strong><p className="muted">Full access to companies, branches, approvals and audit activity.</p></div></section>}
    <section className="card settings-card"><h2>{t.preferences}</h2><label>{t.language}<select value={locale} onChange={event => setLocale(event.target.value)}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option></select></label></section>
    <DeviceNotificationsSetting/>
    <InstallAppCard/>
    {!isCeo && <section className="card settings-card"><h2><Sparkles size={19}/> {copy.tour}</h2><p className="muted">{copy.tourHelp}</p><button className="secondary" type="button" onClick={requestOnboardingReplay}>{copy.tourAction}</button></section>}
    {!isCeo && <section className="card settings-card"><h2>{t.planBilling}</h2><p className="plan-name">{plan === 'free' ? t.free : plan.toUpperCase()}</p><p className="muted">{trialEnd ? `${t.premiumTrial}: ${new Date(trialEnd).toLocaleDateString(locale)}` : t.noTrial}</p><button className="primary" onClick={() => setMessage(t.billingSoon)}>{t.upgradePro}</button></section>}
    <section className="card settings-card"><h2>{t.support}</h2><p className="muted">{t.supportHelp}</p><button className="secondary" onClick={() => setMessage(t.supportReady)}>{t.contactSupport}</button>{message && <p className="muted" role="status">{message}</p>}</section>
  </div></ManagerShell>
}
