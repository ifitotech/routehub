'use client'

import {Mail, Pencil, Send, Trash2, UserPlus, UsersRound, X} from 'lucide-react'
import {useCallback, useEffect, useState} from 'react'
import {roleLabel, roleLabelOptions} from '../../../lib/role-labels'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import type {Role} from '../../../lib/types'
import styles from '../manager-tools.module.css'
import ManagerShell from '../manager-shell'

type Member = {user_id: string; email?: string; name?: string | null; role: string; branch_id?: string}
type Invite = {id: string; email: string; role: string; status: string; created_at?: string}

export default function Team() {
  const {locale, t} = useLocale()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invite[]>([])
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('driver')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const roleChoices = roleLabelOptions(locale)

  const load = useCallback(async () => {
    try {
      setMessage(t.loadingTeam)
      const supabase = getSupabase(); const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error(t.signInTeam)
      const {data: membership} = await supabase.from('company_users').select('company_id,branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
      if (!membership) throw new Error(t.noMembership)
      setCompany(membership.company_id)
      const [{data, error}, {data: inviteRows, error: inviteError}] = await Promise.all([
        supabase.from('company_users').select('user_id,role,branch_id,users(email,name)').eq('company_id', membership.company_id),
        supabase.from('invitations').select('id,email,role,status,created_at').eq('company_id', membership.company_id).order('created_at', {ascending: false}),
      ])
      if (error) throw error
      if (inviteError) throw inviteError
      setMembers((data || []).map((row: any) => ({user_id: row.user_id, role: row.role, branch_id: row.branch_id, email: row.users?.email || undefined, name: row.users?.name || undefined})))
      setInvitations((inviteRows || []) as Invite[])
      setMessage('')
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
  const startEdit = (member: Member) => {
    setEditingMemberId(member.user_id)
    setEditName(member.name?.trim() || '')
    setEditEmail(member.email?.trim() || '')
  }
  const cancelEdit = () => {
    setEditingMemberId(null)
    setEditName('')
    setEditEmail('')
  }
  const saveEdit = async () => {
    if (!editingMemberId) return
    if (!editEmail.trim()) {
      setMessage(locale === 'es' ? 'El correo es requerido.' : locale === 'fr' ? "L'e-mail est requis." : 'Email is required.')
      return
    }
    setEditBusy(true)
    try {
      const supabase = getSupabase()
      const {error: userError} = await supabase.from('users').update({name: editName.trim() || null, email: editEmail.trim()}).eq('id', editingMemberId)
      if (userError) throw userError
      await supabase.from('invitations').update({email: editEmail.trim()}).eq('user_id', editingMemberId).eq('status', 'pending')
      setMessage(locale === 'es' ? 'Miembro actualizado.' : locale === 'fr' ? 'Membre mis à jour.' : 'Member updated.')
      setEditingMemberId(null)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.unableLoadTeam)
    } finally {
      setEditBusy(false)
    }
  }
  const labelFor = (member: Member) => roleLabel(member.role as Role, locale)
  const displayName = (member: Member) => member.name?.trim() || member.email || t.teamMember
  const inviteCopy = locale === 'es'
    ? {title: 'Invitar miembro', help: 'Se le enviará un enlace de activación.', email: 'Correo electrónico', role: 'Rol', send: 'Enviar invitación', sending: 'Enviando…', created: 'Invitación enviada.', driverLimit: (max: number) => `Este espacio permite hasta ${max} conductor.`, pendingTitle: 'Invitaciones', pendingHelp: 'Enlaces de activación enviados a personas que aún no se unen.', revoke: 'Revocar', pending: 'Pendiente', revoked: 'Revocada', accepted: 'Aceptada'}
    : locale === 'fr'
      ? {title: 'Inviter un membre', help: 'Un lien d’activation lui sera envoyé.', email: 'Adresse e-mail', role: 'Rôle', send: 'Envoyer l’invitation', sending: 'Envoi…', created: 'Invitation envoyée.', driverLimit: (max: number) => `Cet espace permet jusqu’à ${max} conducteur.`, pendingTitle: 'Invitations', pendingHelp: 'Liens d’activation envoyés à des personnes qui n’ont pas encore rejoint.', revoke: 'Révoquer', pending: 'En attente', revoked: 'Révoquée', accepted: 'Acceptée'}
      : {title: 'Invite member', help: 'They will receive an activation link.', email: 'Email address', role: 'Role', send: 'Send invitation', sending: 'Sending…', created: 'Invitation sent.', driverLimit: (max: number) => `This workspace allows up to ${max} Driver.`, pendingTitle: 'Invitations', pendingHelp: 'Activation links sent to people who have not joined yet.', revoke: 'Revoke', pending: 'Pending', revoked: 'Revoked', accepted: 'Accepted'}
  const sendInvite = async () => {
    if (!inviteEmail.trim() || inviteBusy) return
    setInviteBusy(true)
    try {
      const supabase = getSupabase(); const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error(t.signInFirst)
      const normalizedEmail = inviteEmail.trim().toLowerCase()
      // Free workspaces support one Driver. Keep the beta Manager account
      // unrestricted so it can test multiple drivers before paid plans ship.
      if (inviteRole === 'driver' && userData.user.email?.toLowerCase() !== 'manager.test@routehub.local') {
        const [{data: driverMembersRows}, {data: pendingInvites}, {data: companyRow}] = await Promise.all([
          supabase.from('company_users').select('user_id').eq('company_id', company).eq('role', 'driver'),
          supabase.from('invitations').select('id').eq('company_id', company).eq('role', 'driver').eq('status', 'pending'),
          supabase.from('companies').select('max_drivers').eq('id', company).maybeSingle(),
        ])
        const maxDrivers = Math.max(1, Number(companyRow?.max_drivers) || 1)
        if ((driverMembersRows || []).length + (pendingInvites || []).length >= maxDrivers) throw new Error(inviteCopy.driverLimit(maxDrivers))
      }
      // This RPC performs the invitation and (for existing Auth accounts) the
      // company membership in one transaction. Do not fall back to a direct
      // insert: that produced dangling invitations that could not be assigned.
      const result = await supabase.rpc('create_team_invitation', {invited_email: normalizedEmail, invited_role: inviteRole})
      if (result.error) throw result.error
      window.dispatchEvent(new Event('routehub:notifications-refresh'))
      setInviteEmail(''); setInviteOpen(false); setMessage(inviteCopy.created)
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : t.unableCreateInvitation) } finally { setInviteBusy(false) }
  }
  const revokeInvite = async (id: string) => {
    const {error} = await getSupabase().from('invitations').update({status: 'revoked', revoked_at: new Date().toISOString()}).eq('id', id)
    setMessage(error ? error.message : t.invitationRevoked)
    if (!error) await load()
  }
  const inviteStatusLabel = (status: string) => status === 'pending' ? inviteCopy.pending : status === 'revoked' ? inviteCopy.revoked : status === 'accepted' ? inviteCopy.accepted : status
  return <ManagerShell active="settings"><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{t.managerTeam}</p><h1 className={styles.title}>{t.teamMembers}</h1><p className={styles.subtitle}>{t.teamHelp}</p></div><button type="button" className={styles.headerAction} onClick={() => setInviteOpen(value => !value)}><UserPlus size={19}/>{t.inviteMember}</button></header>
    {inviteOpen && <section className={styles.panel}>
      <header className={styles.panelHeader}><div><h2>{inviteCopy.title}</h2><p>{inviteCopy.help}</p></div><span className={styles.panelIcon}><Send size={20}/></span></header>
      <div className={styles.formGrid}>
        <label className={styles.field}>{inviteCopy.email}<input type="email" inputMode="email" autoComplete="email" placeholder="name@company.com" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)}/></label>
        <label className={styles.field}>{inviteCopy.role}<select value={inviteRole} onChange={event => setInviteRole(event.target.value)}>{roleChoices.map(choice => <option key={choice.role} value={choice.role}>{choice.label}</option>)}</select></label>
        <button className={styles.saveButton} disabled={inviteBusy || !inviteEmail.trim()} onClick={sendInvite}><Send size={17}/>{inviteBusy ? inviteCopy.sending : inviteCopy.send}</button>
      </div>
    </section>}
    <section className={styles.stats} aria-label={t.teamOverview}><article className={styles.stat}><span>{t.teamMembers}</span><strong>{members.length}</strong></article><article className={styles.stat}><span>{t.drivers}</span><strong>{members.filter(member => member.role === 'driver').length}</strong></article><article className={styles.stat}><span>{t.managers}</span><strong>{members.filter(member => ['branch_manager', 'operations_manager'].includes(member.role)).length}</strong></article></section>
    {message && <p className={styles.status} role="status" aria-live="polite">{message}</p>}<h2 className={styles.sectionLabel}>{t.currentTeam}</h2><section className={styles.list} aria-label={t.currentTeamLabel}>{members.map(member => { const name=displayName(member); const initials=name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase(); const isEditing = editingMemberId === member.user_id; return <article className={styles.memberCard} key={member.user_id}><div className={styles.avatar} aria-hidden="true">{initials || 'TM'}</div>{isEditing ? <div className={styles.editFields}><input type="text" placeholder={locale === 'es' ? 'Nombre (opcional)' : locale === 'fr' ? 'Nom (optionnel)' : 'Name (optional)'} value={editName} onChange={event => setEditName(event.target.value)}/><input type="email" placeholder={locale === 'es' ? 'Correo electrónico' : locale === 'fr' ? 'Adresse e-mail' : 'Email address'} value={editEmail} onChange={event => setEditEmail(event.target.value)}/></div> : <div className={styles.identity}><h2>{name}</h2><p>{member.email && member.name ? `${member.email} · ` : ''}{labelFor(member)}</p></div>}{isEditing ? <div className={styles.editActions}><button className={styles.saveButton} disabled={editBusy} onClick={saveEdit}>{locale === 'es' ? 'Guardar' : locale === 'fr' ? 'Enregistrer' : 'Save'}</button><button className={styles.iconButton} aria-label={locale === 'es' ? 'Cancelar' : locale === 'fr' ? 'Annuler' : 'Cancel'} onClick={cancelEdit} disabled={editBusy}><X size={17}/></button></div> : <><select className={styles.roleSelect} aria-label={`${t.role} — ${name}`} value={member.role} onChange={event => void updateRole(member.user_id, event.target.value)}>{roleChoices.map(choice => <option key={choice.role} value={choice.role}>{choice.label}</option>)}</select><div className={styles.memberActions}><button className={styles.editButton} aria-label={`${locale === 'es' ? 'Editar' : locale === 'fr' ? 'Modifier' : 'Edit'} ${name}`} onClick={() => startEdit(member)}><Pencil size={17}/></button><button className={styles.dangerButton} aria-label={`${t.removeMember} ${name}`} onClick={() => setPendingRemoval(member)}><Trash2 size={18}/></button></div></>}</article>})}{!members.length && !message && <section className={styles.empty}><span><UsersRound size={24}/></span><h2>{t.noTeam}</h2><p>{t.noTeamHelp}</p></section>}</section>
    {/* Invitations used to be its own page (reachable only from Settings),
        which just duplicated this page's own invite form next to a list.
        One place for everything about who's on this branch: send, see who's
        still pending, revoke. */}
    {invitations.length > 0 && <><h2 className={styles.sectionLabel}>{inviteCopy.pendingTitle}</h2><section className={styles.list} aria-label={inviteCopy.pendingTitle}>{invitations.map(invite => <article className={styles.rowCard} key={invite.id}><span className={styles.mailIcon}><Mail size={20}/></span><div className={styles.identity}><h2>{invite.email}</h2><p>{roleChoices.find(choice => choice.role === invite.role)?.label || invite.role}</p></div><div className={styles.rowActions}><div><span className={styles.statusBadge} data-status={invite.status}>{inviteStatusLabel(invite.status)}</span>{invite.created_at && <div className={styles.date}>{new Date(invite.created_at).toLocaleDateString(locale)}</div>}</div>{invite.status === 'pending' && <button className={styles.revokeButton} onClick={() => void revokeInvite(invite.id)}>{inviteCopy.revoke}</button>}</div></article>)}</section></>}
  </div>{pendingRemoval && <div className={styles.confirmBackdrop} role="presentation"><section className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="remove-member-title"><h2 id="remove-member-title">{t.removeMember}</h2><p>{pendingRemoval.email || t.teamMember} {t.removeMemberHelp}</p><div className={styles.confirmActions}><button className={styles.confirmCancel} onClick={() => setPendingRemoval(null)}>{t.keepMember}</button><button className={styles.confirmRemove} onClick={remove}>{t.removeMember}</button></div></section></div>}</ManagerShell>
}
