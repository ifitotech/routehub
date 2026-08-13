'use client'

import {Mail, Send, UserPlus} from 'lucide-react'
import {useCallback, useEffect, useState} from 'react'
import {roleLabelOptions} from '../../../lib/role-labels'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import styles from '../manager-tools.module.css'

type Invite = {id: string; email: string; role: string; status: string; created_at?: string}

export default function Invitations() {
  const {locale, t} = useLocale()
  const [items, setItems] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('driver')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const choices = roleLabelOptions(locale)

  const load = useCallback(async () => {
    try {
      setMessage(t.loadingInvitations)
      const supabase = getSupabase(); const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error(t.signInInvitations)
      const {data: membership} = await supabase.from('company_users').select('company_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
      if (!membership) throw new Error(t.noMembership)
      const {data, error} = await supabase.from('invitations').select('id,email,role,status,created_at').eq('company_id', membership.company_id).order('created_at', {ascending: false})
      if (error) throw error
      setItems(data || []); setMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : t.unableLoadInvitations) }
  }, [t.loadingInvitations, t.signInInvitations, t.noMembership, t.unableLoadInvitations])
  useEffect(() => { void load() }, [load])

  const send = async () => {
    if (!email.trim() || busy) return
    setBusy(true)
    try {
      const supabase = getSupabase(); const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error(t.signInFirst)
      const {data: membership} = await supabase.from('company_users').select('company_id,branch_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
      if (!membership) throw new Error(t.noMembership)
      const normalizedEmail = email.trim().toLowerCase()
      // Free workspaces support one Driver. Keep the beta Manager account
      // unrestricted so it can test multiple drivers before paid plans ship.
      if (role === 'driver' && userData.user.email?.toLowerCase() !== 'manager.test@routehub.local') {
        const [{data: members}, {data: pendingInvites}, {data: company}] = await Promise.all([
          supabase.from('company_users').select('user_id').eq('company_id', membership.company_id).eq('role', 'driver'),
          supabase.from('invitations').select('id').eq('company_id', membership.company_id).eq('role', 'driver').eq('status', 'pending'),
          supabase.from('companies').select('max_drivers').eq('id', membership.company_id).maybeSingle()
        ])
        const maxDrivers = Math.max(1, Number(company?.max_drivers) || 1)
        const pendingOtherThanCurrent = (pendingInvites || []).length
        if ((members || []).length + pendingOtherThanCurrent >= maxDrivers) {
          const limitMessage = locale === 'es'
            ? `Este espacio permite hasta ${maxDrivers} conductor.`
            : locale === 'fr'
              ? `Cet espace permet jusqu’à ${maxDrivers} conducteur.`
              : `This workspace allows up to ${maxDrivers} Driver.`
          throw new Error(limitMessage)
        }
      }

      // This RPC performs the invitation and (for existing Auth accounts) the
      // company membership in one transaction. Do not fall back to a direct
      // insert: that produced dangling invitations that could not be assigned.
      const result = await supabase.rpc('create_team_invitation', {invited_email: normalizedEmail, invited_role: role})
      if (result.error) throw result.error
      window.dispatchEvent(new Event('routehub:notifications-refresh'))
      setEmail(''); setMessage(t.invitationCreated); await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : t.unableCreateInvitation) } finally { setBusy(false) }
  }
  const revoke = async (id: string) => {
    const {error} = await getSupabase().from('invitations').update({status: 'revoked', revoked_at: new Date().toISOString()}).eq('id', id)
    setMessage(error ? error.message : t.invitationRevoked)
    if (!error) await load()
  }
  const statusLabel = (status: string) => status === 'pending' ? t.pending : status === 'revoked' ? t.revoked : status === 'accepted' ? t.accepted : status
  return <main className="app"><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{t.managerAccess}</p><h1 className={styles.title}>{t.teamInvitations}</h1><p className={styles.subtitle}>{t.invitationsHelp}</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t.inviteTeamMember}</h2><p>{t.invitePendingHelp}</p></div><span className={styles.panelIcon}><UserPlus size={21}/></span></header><div className={styles.formGrid}><label className={styles.field}>{t.emailAddress}<input type="email" inputMode="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={event => setEmail(event.target.value)}/></label><label className={styles.field}>{t.role}<select value={role} onChange={event => setRole(event.target.value)}>{choices.map(choice => <option key={choice.role} value={choice.role}>{choice.label}</option>)}</select></label><button className={styles.saveButton} disabled={busy || !email.trim()} onClick={send}><Send size={17}/>{busy ? t.sending : t.sendInvitation}</button></div></section>
    {message && <p className={styles.status} role="status" aria-live="polite">{message}</p>}<h2 className={styles.sectionLabel}>{t.invitationActivity}</h2><section className={styles.list} aria-label={t.teamInvitationsLabel}>{items.map(invite => <article className={styles.rowCard} key={invite.id}><span className={styles.mailIcon}><Mail size={20}/></span><div className={styles.identity}><h2>{invite.email}</h2><p>{choices.find(choice => choice.role === invite.role)?.label || invite.role}</p></div><div className={styles.rowActions}><div><span className={styles.statusBadge} data-status={invite.status}>{statusLabel(invite.status)}</span>{invite.created_at && <div className={styles.date}>{new Date(invite.created_at).toLocaleDateString(locale)}</div>}</div>{invite.status === 'pending' && <button className={styles.revokeButton} onClick={() => revoke(invite.id)}>{t.revoke}</button>}</div></article>)}{!items.length && !message && <section className={styles.empty}><span><Mail size={24}/></span><h2>{t.noInvitations}</h2><p>{t.noInvitationsHelp}</p></section>}</section>
  </div></main>
}
