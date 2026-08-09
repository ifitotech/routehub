'use client'

import Link from 'next/link'
import {MapPin, PackagePlus, Pencil, Phone, Search, Trash2, UserRound, X} from 'lucide-react'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'
import styles from './contacts.module.css'

type Contact = {id: string; company_name: string; contact_name?: string | null; address: string; phone?: string | null}
const emptyForm = {company_name: '', contact_name: '', address: '', phone: ''}

export default function Contacts() {
  const {locale, t} = useLocale()
  const [items, setItems] = useState<Contact[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [canManage, setCanManage] = useState(false)
  const copy = {
    en:{edit:'Edit',remove:'Delete',pickup:'Pickup',delivery:'Delivery',map:'Map',editTitle:'Edit contact',updated:'Contact updated.',deleted:'Contact deleted.',confirm:'Delete contact?',confirmHelp:'This contact will be permanently removed.',keep:'Keep contact'},
    es:{edit:'Editar',remove:'Eliminar',pickup:'Recogida',delivery:'Entrega',map:'Mapa',editTitle:'Editar contacto',updated:'Contacto actualizado.',deleted:'Contacto eliminado.',confirm:'¿Eliminar contacto?',confirmHelp:'Este contacto se eliminará permanentemente.',keep:'Conservar contacto'},
    fr:{edit:'Modifier',remove:'Supprimer',pickup:'Collecte',delivery:'Livraison',map:'Carte',editTitle:'Modifier le contact',updated:'Contact mis à jour.',deleted:'Contact supprimé.',confirm:'Supprimer le contact ?',confirmHelp:'Ce contact sera définitivement supprimé.',keep:'Conserver le contact'},
  }[locale]

  const load = useCallback(async () => {
    try {
      const supabase = getSupabase(); const {data: user} = await supabase.auth.getUser()
      if (!user.user) throw new Error(t.signInContacts)
      const {data: membership, error: membershipError} = await supabase.from('company_users').select('company_id,branch_id,role').eq('user_id', user.user.id).limit(1).maybeSingle()
      if (membershipError || !membership) throw new Error(t.noMembership)
      setCanManage(['branch_manager','operations_manager'].includes(membership.role))
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
      const payload = {company_name: form.company_name.trim(), contact_name: form.contact_name.trim() || null, address: form.address.trim(), phone: form.phone.trim() || null, company_id: membership.company_id, branch_id: membership.branch_id}
      const {error} = editingId ? await supabase.from('contacts').update(payload).eq('id', editingId).eq('company_id', membership.company_id) : await supabase.from('contacts').insert(payload)
      if (error) throw error
      setMessage(editingId ? copy.updated : t.contactSaved); setForm(emptyForm); setEditingId(null); setOpen(false); await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : t.unableSaveContact) } finally { setSaving(false) }
  }
  const edit = (contact: Contact) => { setEditingId(contact.id); setForm({company_name:contact.company_name,contact_name:contact.contact_name || '',address:contact.address,phone:contact.phone || ''}); setOpen(true) }
  const remove = async () => { if (!deleteTarget || saving) return; setSaving(true); try { const supabase=getSupabase(); const {error}=await supabase.from('contacts').delete().eq('id',deleteTarget.id); if(error) throw error; setMessage(copy.deleted); setDeleteTarget(null); await load() } catch(error) { setMessage(error instanceof Error?error.message:t.unableSaveContact) } finally { setSaving(false) } }
  return <main className="app"><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{t.organization}</p><h1>{t.contacts}</h1><p className={styles.subtitle}>{t.contactsHelp}</p></div><button className={styles.addButton} onClick={() => setOpen(true)}>{t.addContact}</button></header>
    <div className={styles.searchPanel}><Search size={20} aria-hidden="true"/><input aria-label={t.searchContacts} placeholder={t.searchNameAddress} value={query} onChange={event => setQuery(event.target.value)}/><span className={styles.count}>{filtered.length} {filtered.length === 1 ? t.contact : t.contactsCount}</span></div>
    <section className={styles.list} aria-label={t.contacts}>{filtered.map(contact => <article className={styles.contactCard} key={contact.id}><div className={styles.avatar} aria-hidden="true">{contact.company_name.slice(0, 2)}</div><div className={styles.identity}><h2>{contact.company_name}</h2><p className={styles.person}>{contact.contact_name || t.contactPerson}</p><p className={styles.address}>{contact.address}</p><div className={styles.cardActions}><Link href={`/routes?contact=${encodeURIComponent(contact.id)}&type=pickup`} title={copy.pickup}><PackagePlus size={16}/>{copy.pickup}</Link><Link href={`/routes?contact=${encodeURIComponent(contact.id)}&type=delivery`} title={copy.delivery}><PackagePlus size={16}/>{copy.delivery}</Link><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`} target="_blank" rel="noreferrer" title={copy.map}><MapPin size={16}/><span>{copy.map}</span></a>{contact.phone && <a href={`tel:${contact.phone}`} title={t.call}><Phone size={16}/><span>{t.call}</span></a>}{canManage && <><button onClick={() => edit(contact)} title={copy.edit}><Pencil size={16}/><span>{copy.edit}</span></button><button className={styles.dangerAction} onClick={() => setDeleteTarget(contact)} title={copy.remove}><Trash2 size={16}/><span>{copy.remove}</span></button></>}</div></div></article>)}{!filtered.length && <section className={styles.empty}><span className={styles.emptyIcon}><UserRound size={24}/></span><h2>{t.noContacts}</h2><p>{query ? t.tryAnotherContact : t.addFirstContact}</p></section>}</section>
    {message && <p className={styles.status} role="status" aria-live="polite">{message}</p>}
  </div>{open && <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) {setOpen(false);setEditingId(null);setForm(emptyForm)} }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="new-contact-title"><header className={styles.dialogHeader}><div><h2 id="new-contact-title">{editingId ? copy.editTitle : t.newContact}</h2><p>{t.newContactHelp}</p></div><button className={styles.closeButton} aria-label={t.close} onClick={() => {setOpen(false);setEditingId(null);setForm(emptyForm)}}><X size={20}/></button></header><div className={styles.form}>{(['company_name', 'contact_name', 'address', 'phone'] as const).map(key => <label className={styles.field} key={key}>{key === 'company_name' ? t.company : key === 'contact_name' ? t.contactPerson : key === 'address' ? t.address : t.phone}<input placeholder={key === 'company_name' ? 'ABC Supply' : key === 'contact_name' ? t.contactName : key === 'address' ? t.addressPlaceholder : '(000) 000-0000'} value={form[key]} onChange={event => setForm({...form, [key]: event.target.value})}/></label>)}<div className={styles.dialogActions}><button className={styles.cancelButton} onClick={() => {setOpen(false);setEditingId(null);setForm(emptyForm)}}>{t.cancel}</button><button className={styles.saveButton} disabled={saving || !form.company_name.trim() || !form.address.trim()} onClick={save}>{saving ? t.saving : t.saveContact}</button></div></div></section></div>}{deleteTarget && <div className={styles.backdrop}><section className={styles.confirmDialog} role="alertdialog" aria-modal="true"><Trash2 size={26}/><h2>{copy.confirm}</h2><p>{deleteTarget.company_name}</p><p>{copy.confirmHelp}</p><div className={styles.dialogActions}><button className={styles.cancelButton} onClick={() => setDeleteTarget(null)}>{copy.keep}</button><button className={styles.deleteButton} disabled={saving} onClick={() => void remove()}>{saving?t.saving:copy.remove}</button></div></section></div>}</main>
}
