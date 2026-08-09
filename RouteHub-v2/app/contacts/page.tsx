'use client'

import {Phone, Search, UserRound, X} from 'lucide-react'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'
import styles from './contacts.module.css'

type Contact = {id: string; company_name: string; contact_name?: string | null; address: string; phone?: string | null}
const emptyForm = {company_name: '', contact_name: '', address: '', phone: ''}

export default function Contacts() {
  const {t} = useLocale()
  const [items, setItems] = useState<Contact[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    try {
      const supabase = getSupabase(); const {data: user} = await supabase.auth.getUser()
      if (!user.user) throw new Error(t.signInContacts)
      const {data: membership, error: membershipError} = await supabase.from('company_users').select('company_id,branch_id').eq('user_id', user.user.id).limit(1).maybeSingle()
      if (membershipError || !membership) throw new Error(t.noMembership)
      const {data, error} = await supabase.from('contacts').select('id,company_name,contact_name,address,phone').eq('company_id', membership.company_id).order('company_name')
      if (error) throw error
      setItems(data || [])
    } catch (error) { setMessage(error instanceof Error ? error.message : t.unableLoadContacts) }
  }, [t.signInContacts, t.noMembership, t.unableLoadContacts])
  useEffect(() => { void load() }, [load])
  const filtered = useMemo(() => { const term = query.trim().toLowerCase(); return items.filter(contact => `${contact.company_name} ${contact.contact_name || ''} ${contact.address}`.toLowerCase().includes(term)) }, [items, query])
  const save = async () => {
    if (!form.company_name.trim() || !form.address.trim() || saving) return
    setSaving(true)
    try {
      const supabase = getSupabase(); const {data: user} = await supabase.auth.getUser()
      if (!user.user) throw new Error(t.signInFirst)
      const {data: membership} = await supabase.from('company_users').select('company_id,branch_id').eq('user_id', user.user.id).limit(1).maybeSingle()
      if (!membership) throw new Error(t.noMembership)
      const {error} = await supabase.from('contacts').insert({company_name: form.company_name.trim(), contact_name: form.contact_name.trim() || null, address: form.address.trim(), phone: form.phone.trim() || null, company_id: membership.company_id, branch_id: membership.branch_id})
      if (error) throw error
      setMessage(t.contactSaved); setForm(emptyForm); setOpen(false); await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : t.unableSaveContact) } finally { setSaving(false) }
  }
  return <main className="app"><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{t.organization}</p><h1>{t.contacts}</h1><p className={styles.subtitle}>{t.contactsHelp}</p></div><button className={styles.addButton} onClick={() => setOpen(true)}>{t.addContact}</button></header>
    <div className={styles.searchPanel}><Search size={20} aria-hidden="true"/><input aria-label={t.searchContacts} placeholder={t.searchNameAddress} value={query} onChange={event => setQuery(event.target.value)}/><span className={styles.count}>{filtered.length} {filtered.length === 1 ? t.contact : t.contactsCount}</span></div>
    <section className={styles.list} aria-label={t.contacts}>{filtered.map(contact => <article className={styles.contactCard} key={contact.id}><div className={styles.avatar} aria-hidden="true">{contact.company_name.slice(0, 2)}</div><div className={styles.identity}><h2>{contact.company_name}</h2><p className={styles.person}>{contact.contact_name || t.contactPerson}</p><p className={styles.address}>{contact.address}</p></div>{contact.phone && <a className={styles.callButton} href={`tel:${contact.phone}`} aria-label={`${t.call} ${contact.company_name}`}><Phone size={19}/></a>}</article>)}{!filtered.length && <section className={styles.empty}><span className={styles.emptyIcon}><UserRound size={24}/></span><h2>{t.noContacts}</h2><p>{query ? t.tryAnotherContact : t.addFirstContact}</p></section>}</section>
    {message && <p className={styles.status} role="status" aria-live="polite">{message}</p>}
  </div>{open && <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false) }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="new-contact-title"><header className={styles.dialogHeader}><div><h2 id="new-contact-title">{t.newContact}</h2><p>{t.newContactHelp}</p></div><button className={styles.closeButton} aria-label={t.close} onClick={() => setOpen(false)}><X size={20}/></button></header><div className={styles.form}>{(['company_name', 'contact_name', 'address', 'phone'] as const).map(key => <label className={styles.field} key={key}>{key === 'company_name' ? t.company : key === 'contact_name' ? t.contactPerson : key === 'address' ? t.address : t.phone}<input placeholder={key === 'company_name' ? 'ABC Supply' : key === 'contact_name' ? t.contactName : key === 'address' ? t.addressPlaceholder : '(000) 000-0000'} value={form[key]} onChange={event => setForm({...form, [key]: event.target.value})}/></label>)}<div className={styles.dialogActions}><button className={styles.cancelButton} onClick={() => setOpen(false)}>{t.cancel}</button><button className={styles.saveButton} disabled={saving || !form.company_name.trim() || !form.address.trim()} onClick={save}>{saving ? t.saving : t.saveContact}</button></div></div></section></div>}</main>
}
