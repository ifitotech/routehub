'use client'

import {LogOut, Save, ShieldCheck, User} from 'lucide-react'
import {useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import AdminShell from '../admin-shell'
import styles from '../admin.module.css'

export default function AdminSettings() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void getSupabase().auth.getUser().then(({data}) => {
      const user = data.user
      setEmail(user?.email || '')
      setNewEmail(user?.email || '')
      setFullName(String(user?.user_metadata?.full_name || user?.user_metadata?.name || ''))
    })
  }, [])

  const saveProfile = async () => {
    if (profileSaving) return
    setProfileSaving(true)
    setMessage('')
    const client = getSupabase()
    const emailChanged = newEmail.trim().toLowerCase() !== email.trim().toLowerCase()
    const {error} = await client.auth.updateUser({
      data: {full_name: fullName.trim()},
      ...(emailChanged ? {email: newEmail.trim().toLowerCase()} : {}),
    })
    setMessage(error ? error.message : emailChanged ? 'Profile saved. Check your new inbox to confirm the email change.' : 'Profile saved.')
    setProfileSaving(false)
  }

  const changePassword = async () => {
    if (passwordSaving) return
    if (newPassword.length < 8) { setMessage('Use at least 8 characters for the password.'); return }
    if (newPassword !== confirmNewPassword) { setMessage('Passwords do not match.'); return }
    setPasswordSaving(true)
    setMessage('')
    const {error} = await getSupabase().auth.updateUser({password: newPassword})
    setMessage(error ? error.message : 'Password updated.')
    if (!error) { setNewPassword(''); setConfirmNewPassword('') }
    setPasswordSaving(false)
  }

  const signOut = async () => {
    await getSupabase().auth.signOut()
    window.location.assign('/login')
  }

  return (
    <AdminShell active="settings">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CEO / Admin · Settings</p>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Manage your own CEO account - name, email and password.</p>
        </div>
      </header>

      {message && <p className={styles.statusMessage}>{message}</p>}

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><h2>Profile</h2><p>Signed in as {email || '—'}</p></div>
          <span className={styles.panelIcon}><User size={21}/></span>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.field}>Full name<input aria-label="Full name" placeholder="Your name" value={fullName} onChange={event => setFullName(event.target.value)}/></label>
          <label className={styles.field}>Email<input type="email" aria-label="Email" placeholder="you@company.com" value={newEmail} onChange={event => setNewEmail(event.target.value)}/></label>
          <button className={styles.primaryButton} disabled={profileSaving || !fullName.trim() || !newEmail.trim()} onClick={() => void saveProfile()}><Save size={16}/>{profileSaving ? 'Saving…' : 'Save profile'}</button>
        </div>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><h2>Password</h2><p>Update your password without an email link.</p></div>
          <span className={styles.panelIcon}><ShieldCheck size={21}/></span>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.field}>New password<input type="password" autoComplete="new-password" aria-label="New password" placeholder="8+ characters" value={newPassword} onChange={event => setNewPassword(event.target.value)}/></label>
          <label className={styles.field}>Confirm password<input type="password" autoComplete="new-password" aria-label="Confirm password" value={confirmNewPassword} onChange={event => setConfirmNewPassword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void changePassword() }}/></label>
          <button className={styles.primaryButton} disabled={passwordSaving || !newPassword || !confirmNewPassword} onClick={() => void changePassword()}><ShieldCheck size={16}/>{passwordSaving ? 'Saving…' : 'Save password'}</button>
        </div>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div><h2>Session</h2><p>Sign out of this CEO session on this device.</p></div>
        </header>
        <button className={styles.dangerButton} onClick={() => void signOut()}><LogOut size={16}/>Sign out</button>
      </section>
    </AdminShell>
  )
}
