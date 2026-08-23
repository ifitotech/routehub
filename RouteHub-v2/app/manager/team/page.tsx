'use client'

import {Star, Trash2, UserPlus, UsersRound} from 'lucide-react'
import Link from 'next/link'
import {useCallback, useEffect, useState} from 'react'
import {roleLabel} from '../../../lib/role-labels'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import type {Role} from '../../../lib/types'
import styles from '../manager-tools.module.css'

type Member = {user_id: string; email?: string; name?: string | null; role: string; branch_id?: string}
type Branch = {id: string; name: string; primary_driver_id: string | null; auto_close_time?: string | null}

export default function Team() {
  const {locale, t} = useLocale()
  const [members, setMembers] = useState<Member[]>([])
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState('')
  const [branch, setBranch] = useState<Branch | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null)

  const load = useCallback(async () => {
    try {
      setMessage(t.loadingTeam)
      const supabase = getSupabase(); const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error(t.signInTeam)
      const {data: membership} = await supabase.from('company_users').select('company_id,branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
      if (!membership) throw new Error(t.noMembership)
      setCompany(membership.company_id)
      const {data, error} = await supabase.from('company_users').select('user_id,role,branch_id,users(email,name)').eq('company_id', membership.company_id)
      if (error) throw error
      const branchQuery=membership.branch_id
        ? supabase.from('branches').select('id,name,primary_driver_id').eq('id',membership.branch_id).maybeSingle()
        : supabase.from('branches').select('id,name,primary_driver_id').eq('company_id',membership.company_id).order('name').limit(1).maybeSingle()
      const {data:branchData,error:branchError}=await branchQuery
      if(branchError)throw branchError
      let branchWithSettings=branchData as Branch|null
      if(branchWithSettings){
        const settings=await supabase.from('branches').select('auto_close_time').eq('id',branchWithSettings.id).maybeSingle()
        if(!settings.error&&settings.data)branchWithSettings={...branchWithSettings,auto_close_time:settings.data.auto_close_time}
      }
      setBranch(branchWithSettings)
      setMembers((data || []).map((row: any) => ({user_id: row.user_id, role: row.role, branch_id: row.branch_id, email: row.users?.email || undefined, name: row.users?.name || undefined}))); setMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : t.unableLoadTeam) }
  }, [t.loadingTeam, t.signInTeam, t.noMembership, t.unableLoadTeam])
  useEffect(() => { void load() }, [load])
  const updateRole = async (userId: string, role: string) => {
    const {error} = await getSupabase().from('company_users').update({role}).eq('company_id', company).eq('user_id', userId)
    setMessage(error ? error.message : t.roleUpdated); if (!error) await load()
  }
  const remove = async () => {
    if (!pendingRemoval) return
    const {error} = await getSupabase().from('company_users').delete().eq('company_id', company).eq('user_id', pendingRemoval.user_id)
    setMessage(error ? error.message : t.memberRemoved)
    if (!error) { setPendingRemoval(null); await load() }
  }
  const labelFor = (member: Member) => roleLabel(member.role as Role, locale)
  const displayName = (member: Member) => member.name?.trim() || member.email || t.teamMember
  const driverMembers = members.filter(member => member.role === 'driver')
  const primaryCopy=locale==='es'?{title:'Conductor principal',help:'Se selecciona automáticamente al crear una ruta.',choose:'Seleccionar conductor',saved:'Conductor principal actualizado.'}:locale==='fr'?{title:'Conducteur principal',help:'Sélectionné automatiquement lors de la création d’un itinéraire.',choose:'Choisir un conducteur',saved:'Conducteur principal mis à jour.'}:{title:'Primary Driver',help:'Automatically selected when a new route is created.',choose:'Choose a Driver',saved:'Primary Driver updated.'}
  const setPrimaryDriver=async(userId:string)=>{
    if(!branch)return
    const {error}=await getSupabase().from('branches').update({primary_driver_id:userId||null}).eq('id',branch.id)
    setMessage(error?error.message:primaryCopy.saved)
    if(!error)setBranch({...branch,primary_driver_id:userId||null})
  }
  const setAutoCloseTime=async(value:string)=>{
    if(!branch)return
    const {error}=await getSupabase().from('branches').update({auto_close_time:value}).eq('id',branch.id)
    setMessage(error?error.message:(locale==='es'?'Hora de cierre actualizada.':locale==='fr'?'Heure de fermeture mise à jour.':'Automatic close time updated.'))
    if(!error)setBranch({...branch,auto_close_time:value})
  }
  return <main className="app"><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{t.managerTeam}</p><h1 className={styles.title}>{t.teamMembers}</h1><p className={styles.subtitle}>{t.teamHelp}</p></div><Link className={styles.headerAction} href="/manager/invitations"><UserPlus size={19}/>{t.inviteMember}</Link></header>
    {branch&&<section className={styles.panel}>{driverMembers.length>1&&<><div className={styles.panelHeader}><div><h2>Driver priorities</h2><p>{branch.name} · Choose the default driver for automatic route assignment.</p></div><span className={styles.panelIcon}><Star size={20}/></span></div><label className={styles.field}>{primaryCopy.choose}<select value={branch.primary_driver_id||''} onChange={event=>void setPrimaryDriver(event.target.value)}><option value="">{primaryCopy.choose}</option>{driverMembers.filter(member=>member.branch_id==null||member.branch_id===branch.id).map(member=><option key={member.user_id} value={member.user_id}>★ {displayName(member)}</option>)}</select></label></>}<label className={styles.field}>{locale==='es'?'Cierre automático de jornada':locale==='fr'?'Fermeture automatique de la journée':'Automatic driving-day close'}<input type="time" value={(branch.auto_close_time||'18:00').slice(0,5)} onChange={event=>void setAutoCloseTime(event.target.value)}/><small>{locale==='es'?'Solo cierra si no quedan rutas pendientes.':locale==='fr'?'Ferme uniquement si aucun itinéraire ne reste.':'Closes only when no routes remain pending.'}</small></label></section>}
    <section className={styles.stats} aria-label={t.teamOverview}><article className={styles.stat}><span>{t.teamMembers}</span><strong>{members.length}</strong></article><article className={styles.stat}><span>{t.drivers}</span><strong>{members.filter(member => member.role === 'driver').length}</strong></article><article className={styles.stat}><span>{t.managers}</span><strong>{members.filter(member => ['branch_manager', 'operations_manager'].includes(member.role)).length}</strong></article></section>
    {message && <p className={styles.status} role="status" aria-live="polite">{message}</p>}<h2 className={styles.sectionLabel}>{t.currentTeam}</h2><section className={styles.list} aria-label={t.currentTeamLabel}>{members.map(member => { const name=displayName(member); const initials=name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase(); return <article className={styles.memberCard} key={member.user_id}><div className={styles.avatar} aria-hidden="true">{initials || 'TM'}</div><div className={styles.identity}><h2>{name}</h2><p>{member.email && member.name ? `${member.email} · ` : ''}{labelFor(member)}</p></div><button className={styles.dangerButton} aria-label={`${t.removeMember} ${name}`} onClick={() => setPendingRemoval(member)}><Trash2 size={18}/></button></article>})}{!members.length && !message && <section className={styles.empty}><span><UsersRound size={24}/></span><h2>{t.noTeam}</h2><p>{t.noTeamHelp}</p></section>}</section>
  </div>{pendingRemoval && <div className={styles.confirmBackdrop} role="presentation"><section className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="remove-member-title"><h2 id="remove-member-title">{t.removeMember}</h2><p>{pendingRemoval.email || t.teamMember} {t.removeMemberHelp}</p><div className={styles.confirmActions}><button className={styles.confirmCancel} onClick={() => setPendingRemoval(null)}>{t.keepMember}</button><button className={styles.confirmRemove} onClick={remove}>{t.removeMember}</button></div></section></div>}</main>
}
