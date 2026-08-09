'use client'

import {Trash2, UserPlus, UsersRound} from 'lucide-react'
import Link from 'next/link'
import {useCallback, useEffect, useState} from 'react'
import {roleLabel, roleLabelOptions} from '../../../lib/role-labels'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import type {Role} from '../../../lib/types'
import styles from '../manager-tools.module.css'

type Member = {user_id: string; email?: string; role: string; branch_id?: string}

export default function Team() {
  const {locale, t} = useLocale()
  const [members, setMembers] = useState<Member[]>([])
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null)
  const roles = roleLabelOptions(locale)

  const load = useCallback(async () => {
    try {
      setMessage(t.loadingTeam)
      const supabase = getSupabase(); const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error(t.signInTeam)
      const {data: membership} = await supabase.from('company_users').select('company_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
      if (!membership) throw new Error(t.noMembership)
      setCompany(membership.company_id)
      const {data, error} = await supabase.from('company_users').select('user_id,role,branch_id,users(email)').eq('company_id', membership.company_id)
      if (error) throw error
      setMembers((data || []).map((row: any) => ({user_id: row.user_id, role: row.role, branch_id: row.branch_id, email: row.users?.email || undefined}))); setMessage('')
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
  return <main className="app"><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{t.managerTeam}</p><h1 className={styles.title}>{t.teamMembers}</h1><p className={styles.subtitle}>{t.teamHelp}</p></div><Link className={styles.headerAction} href="/manager/invitations"><UserPlus size={19}/>{t.inviteMember}</Link></header>
    <section className={styles.stats} aria-label={t.teamOverview}><article className={styles.stat}><span>{t.teamMembers}</span><strong>{members.length}</strong></article><article className={styles.stat}><span>{t.drivers}</span><strong>{members.filter(member => member.role === 'driver').length}</strong></article><article className={styles.stat}><span>{t.managers}</span><strong>{members.filter(member => ['branch_manager', 'operations_manager'].includes(member.role)).length}</strong></article></section>
    {message && <p className={styles.status} role="status" aria-live="polite">{message}</p>}<h2 className={styles.sectionLabel}>{t.currentTeam}</h2><section className={styles.list} aria-label={t.currentTeamLabel}>{members.map(member => <article className={styles.memberCard} key={member.user_id}><div className={styles.avatar} aria-hidden="true">{(member.email || 'TM').slice(0, 2)}</div><div className={styles.identity}><h2>{member.email || t.teamMember}</h2><p>{labelFor(member)}</p></div><select className={styles.roleSelect} aria-label={`${t.role}: ${member.email || t.teamMember}`} value={member.role} onChange={event => updateRole(member.user_id, event.target.value)}>{roles.map(({role, label}) => <option value={role} key={role}>{label}</option>)}</select><button className={styles.dangerButton} aria-label={`${t.removeMember} ${member.email || t.teamMember}`} onClick={() => setPendingRemoval(member)}><Trash2 size={18}/></button></article>)}{!members.length && !message && <section className={styles.empty}><span><UsersRound size={24}/></span><h2>{t.noTeam}</h2><p>{t.noTeamHelp}</p></section>}</section>
  </div>{pendingRemoval && <div className={styles.confirmBackdrop} role="presentation"><section className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="remove-member-title"><h2 id="remove-member-title">{t.removeMember}</h2><p>{pendingRemoval.email || t.teamMember} {t.removeMemberHelp}</p><div className={styles.confirmActions}><button className={styles.confirmCancel} onClick={() => setPendingRemoval(null)}>{t.keepMember}</button><button className={styles.confirmRemove} onClick={remove}>{t.removeMember}</button></div></section></div>}</main>
}
