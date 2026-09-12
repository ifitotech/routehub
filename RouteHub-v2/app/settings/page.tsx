'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {Building2, Camera, ChevronRight, History, LogOut, Save, Send, Truck, Users} from 'lucide-react'
import {getSupabase} from '../../lib/supabase'
import {useLocale, useThemePreference} from '../../lib/use-preferences'
import {sanitizeCoordinate, type MapPoint} from '../../lib/maps/coordinates'
import GoogleAddressInput from '../google-address-input'
import DeviceNotificationsSetting from '../device-notifications-setting'
import InstallAppCard from '../install-app-card'
import {requestOnboardingReplay} from '../../lib/onboarding'
import ManagerShell from '../manager/manager-shell'
import styles from './settings.module.css'

type BranchSettings = {id: string; name: string; address: string; phone: string; coordinate: MapPoint | null}

export default function Settings() {
  const {locale, t, setLocale} = useLocale()
  // Keep the stored theme preference applied globally (Driver still uses it);
  // Manager itself is intentionally light-only, so there is no theme control here.
  useThemePreference()
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
    ? {name:'Nombre completo', phone:'Teléfono', photo:'Cambiar foto', edit:'Editar', save:'Guardar perfil', profileSaved:'Perfil actualizado.', branch:'Sucursal', branchName:'Nombre de la sucursal', branchAddress:'Dirección de la sucursal', branchPhone:'Teléfono de la sucursal', saveBranch:'Guardar sucursal', branchSaved:'Sucursal actualizada.', noBranch:'No hay una sucursal asignada.', tour:'Recorrido de la app', tourHelp:'Vuelve a ver la guía rápida de RouteHub.', tourAction:'Ver recorrido', preferences:'Preferencias', language:'Idioma', notifications:'Notificaciones', app:'App', operations:'Operaciones', reportsHistory:'Reportes e historial', reportsHistoryHelp:'Conteos, actividad, días anteriores y evidencia.', truck:'Camión', truckHelp:'Registros del vehículo.', team:'Equipo e invitaciones', teamHelp:'Miembros, roles e invitaciones.', legal:'Legal', privacy:'Privacidad', terms:'Términos'}
    : locale === 'fr'
      ? {name:'Nom complet', phone:'Téléphone', photo:'Changer la photo', edit:'Modifier', save:'Enregistrer le profil', profileSaved:'Profil mis à jour.', branch:'Succursale', branchName:'Nom de la succursale', branchAddress:'Adresse de la succursale', branchPhone:'Téléphone de la succursale', saveBranch:'Enregistrer la succursale', branchSaved:'Succursale mise à jour.', noBranch:'Aucune succursale associée.', tour:'Visite de l’application', tourHelp:'Revoir le guide rapide de RouteHub.', tourAction:'Voir la visite', preferences:'Préférences', language:'Langue', notifications:'Notifications', app:'Application', operations:'Opérations', reportsHistory:'Rapports et historique', reportsHistoryHelp:'Totaux, activité, jours passés et preuves.', truck:'Camion', truckHelp:'Fiche véhicule.', team:'Équipe et invitations', teamHelp:'Membres, rôles et invitations.', legal:'Mentions', privacy:'Confidentialité', terms:'Conditions'}
      : {name:'Full name', phone:'Phone number', photo:'Change photo', edit:'Edit', save:'Save profile', profileSaved:'Profile updated.', branch:'Branch', branchName:'Branch name', branchAddress:'Branch address', branchPhone:'Branch phone number', saveBranch:'Save branch', branchSaved:'Branch updated.', noBranch:'No branch assigned.', tour:'App tour', tourHelp:'See the RouteHub quick guide again.', tourAction:'View tour', preferences:'Preferences', language:'Language', notifications:'Notifications', app:'App', operations:'Operations', reportsHistory:'Reports & History', reportsHistoryHelp:'Counts, activity, past days and proof.', truck:'Truck', truckHelp:'Vehicle records.', team:'Team & invitations', teamHelp:'Members, roles and invitations.', legal:'Legal', privacy:'Privacy', terms:'Terms'}

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
        coordinate: sanitizeCoordinate({lat: branchData.latitude, lng: branchData.longitude}),
      })
    }
    void loadSettings()
    const onPageShow = () => { if (active) void loadSettings() }
    window.addEventListener('pageshow', onPageShow)
    return () => { active = false; window.removeEventListener('pageshow', onPageShow) }
  }, [])

  const signOut = async () => { await getSupabase().auth.signOut(); window.location.assign('/') }
  const saveProfile = async () => {
    if (profileSaving) return
    setProfileSaving(true)
    const {error} = await getSupabase().auth.updateUser({data: {full_name: fullName.trim(), phone: phone.trim(), avatar_url: avatarUrl || null}})
    setMessage(error ? error.message : copy.profileSaved)
    if (!error) setEditingProfile(false)
    setProfileSaving(false)
  }
  const choosePhoto = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      const image = new Image()
      image.onload = () => {
        const size = 320
        const scale = Math.min(1, size / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) return
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        setAvatarUrl(canvas.toDataURL('image/jpeg', 0.78))
      }
      image.src = reader.result
    }
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
      latitude: coordinate?.lat ?? null,
      longitude: coordinate?.lng ?? null,
    }).eq('id', branch.id)
    setMessage(error ? error.message : copy.branchSaved)
    setBranchSaving(false)
  }

  const operations = [
    {href: '/manager/history', label: copy.reportsHistory, help: copy.reportsHistoryHelp, Icon: History},
    {href: '/manager/truck', label: copy.truck, help: copy.truckHelp, Icon: Truck},
    {href: '/manager/team', label: copy.team, help: copy.teamHelp, Icon: Users},
    {href: '/manager/invitations', label: t.invitations, help: '', Icon: Send},
  ]

  return (
    <ManagerShell active="settings" roleLabel={t.managerRole}>
      <div className={styles.page}>
        <p className={styles.eyebrow}>{t.account.toUpperCase()}</p>
        <h1>{t.settings}</h1>

        <p className={styles.group}>{t.profile}</p>
        <section className={styles.card}>
          <button className={styles.row} type="button" onClick={() => setEditingProfile(value => !value)}>
            <span className={styles.avatar}>{avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{(fullName || email || 'U').slice(0, 2).toUpperCase()}</span>}</span>
            <span className={styles.copy}><strong>{fullName || t.profile}</strong><small>{email || phone || copy.phone}</small></span>
            <span className={styles.meta}>{copy.edit}</span>
          </button>
          {editingProfile && (
            <div className={styles.editor}>
              <label className={styles.photo}><Camera size={16}/>{copy.photo}<input type="file" accept="image/*" onChange={event => choosePhoto(event.target.files?.[0])}/></label>
              <label>{copy.name}<input value={fullName} onChange={event => setFullName(event.target.value)} /></label>
              <label>{t.signedInEmail}<input value={email} readOnly /></label>
              <label>{copy.phone}<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="(000) 000-0000" /></label>
              <button className={styles.primary} disabled={profileSaving} onClick={saveProfile}><Save size={16}/>{profileSaving ? t.saving : copy.save}</button>
            </div>
          )}
        </section>

        {!isCeo && (
          <>
            <p className={styles.group}>{copy.branch}</p>
            <section className={styles.card}>
              {branch ? (
                <>
                  <button className={styles.row} type="button" onClick={() => setEditingBranch(value => !value)}>
                    <span className={styles.icon}><Building2 size={18} /></span>
                    <span className={styles.copy}><strong>{branch.name || copy.branchName}</strong><small>{branch.address || t.addressNotConfigured}</small></span>
                    <span className={styles.meta}>{copy.edit}</span>
                  </button>
                  {editingBranch && (
                    <div className={styles.editor}>
                      <label>{copy.branchName}<input value={branch.name} onChange={event => setBranch({...branch, name: event.target.value})}/></label>
                      <label>{copy.branchAddress}<GoogleAddressInput value={branch.address} autoComplete="street-address" onValueChange={value => setBranch(current => current ? {...current, address: value, coordinate: null} : current)} onSelectSearchSuggestion={suggestion => setBranch(current => current ? {...current, address: suggestion.label, coordinate: sanitizeCoordinate(suggestion.coordinate)} : current)} placeholder={t.addressPlaceholder}/></label>
                      <label>{copy.branchPhone}<input type="tel" value={branch.phone} onChange={event => setBranch({...branch, phone: event.target.value})} placeholder="(000) 000-0000"/></label>
                      <button className={styles.primary} disabled={branchSaving} onClick={saveBranch}><Save size={16}/>{branchSaving ? t.saving : copy.saveBranch}</button>
                    </div>
                  )}
                  <Link className={styles.row} href="/manager/branches">
                    <span className={styles.copy}><strong>{t.branches}</strong></span>
                    <ChevronRight size={18} />
                  </Link>
                </>
              ) : <p className={styles.hint}>{copy.noBranch}</p>}
            </section>
          </>
        )}

        {isCeo && (
          <section className={styles.card}>
            <div className={styles.row}><span className={styles.copy}><strong>CEO / Platform administrator</strong><small>Companies, branches, approvals and audit.</small></span></div>
          </section>
        )}

        <p className={styles.group}>{copy.preferences}</p>
        <section className={styles.card}>
          <div className={styles.row}>
            <span className={styles.copy}><strong>{copy.language}</strong></span>
            <div className={styles.seg} role="group" aria-label={copy.language}>
              {[{id:'en', label:'EN'}, {id:'es', label:'ES'}, {id:'fr', label:'FR'}].map(item => (
                <button key={item.id} type="button" data-on={locale === item.id ? 'true' : 'false'} onClick={() => setLocale(item.id)}>{item.label}</button>
              ))}
            </div>
          </div>
          <button className={styles.row} type="button" onClick={requestOnboardingReplay}>
            <span className={styles.copy}><strong>{copy.tour}</strong><small>{copy.tourHelp}</small></span>
            <span className={styles.meta}>{copy.tourAction}</span>
          </button>
        </section>

        <p className={styles.group}>{copy.notifications}</p>
        <div className={styles.embed}>
          <DeviceNotificationsSetting />
        </div>

        <p className={styles.group}>{copy.app}</p>
        <div className={styles.embed}>
          <InstallAppCard />
        </div>

        {!isCeo && (
          <>
            <p className={styles.group}>{copy.operations}</p>
            <section className={styles.card}>
              {operations.map(({href, label, help, Icon}) => (
                <Link key={href} className={styles.row} href={href}>
                  <span className={styles.icon}><Icon size={18} /></span>
                  <span className={styles.copy}><strong>{label}</strong>{help ? <small>{help}</small> : null}</span>
                  <ChevronRight size={18} />
                </Link>
              ))}
            </section>

            <p className={styles.group}>{t.planBilling}</p>
            <section className={styles.card}>
              <div className={styles.row}>
                <span className={styles.copy}><strong>{t.planBilling}</strong><small>{trialEnd ? `${t.premiumTrial}: ${new Date(trialEnd).toLocaleDateString(locale)}` : t.noTrial}</small></span>
                <span className={styles.meta}>{plan === 'free' ? t.free : plan.toUpperCase()}</span>
              </div>
            </section>
          </>
        )}

        <p className={styles.group}>{t.support}</p>
        <section className={styles.card}>
          <button className={styles.row} type="button" onClick={() => setMessage(t.supportReady)}>
            <span className={styles.copy}><strong>{t.contactSupport}</strong><small>{t.supportHelp}</small></span>
            <ChevronRight size={18} />
          </button>
          <Link className={styles.row} href="/privacy"><span className={styles.copy}><strong>{copy.privacy}</strong></span><ChevronRight size={18} /></Link>
          <Link className={styles.row} href="/terms"><span className={styles.copy}><strong>{copy.terms}</strong></span><ChevronRight size={18} /></Link>
        </section>

        <button className={styles.signOut} type="button" onClick={signOut}><LogOut size={16}/>{t.logout}</button>
        {message && <p className={styles.status} role="status">{message}</p>}
      </div>
    </ManagerShell>
  )
}
