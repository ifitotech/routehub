'use client'

import {Building2, MapPin, Pencil, Plus, X} from 'lucide-react'
import {useCallback, useEffect, useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import styles from '../manager-tools.module.css'
import GoogleAddressInput from '../../google-address-input'

type Branch = {id: string; name: string; address?: string; phone?: string; active?: boolean}

export default function Branches() {
  const {t, locale} = useLocale()
  const [branches, setBranches] = useState<Branch[]>([])
  const [form, setForm] = useState({name: '', address: '', phone: ''})
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editLabel = locale === 'es' ? 'Editar sucursal' : locale === 'fr' ? 'Modifier la succursale' : 'Edit branch'
  const editHelp = locale === 'es' ? 'Actualiza el nombre y la dirección de esta sucursal.' : locale === 'fr' ? 'Mettez à jour le nom et l’adresse de cette succursale.' : 'Update this branch name and address.'
  const updateLabel = locale === 'es' ? 'Actualizar sucursal' : locale === 'fr' ? 'Mettre à jour' : 'Update branch'
  const load = useCallback(async () => {
    try {
      setMessage(t.loadingBranches)
      const supabase = getSupabase(); const {data: userData} = await supabase.auth.getUser()
      if (!userData.user) throw new Error(t.signInBranches)
      const {data: membership} = await supabase.from('company_users').select('company_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
      if (!membership) throw new Error(t.noMembership)
      setCompany(membership.company_id)
      const {data, error} = await supabase.from('branches').select('*').eq('company_id', membership.company_id).order('name')
      if (error) throw error
      setBranches(data || []); setMessage('')
    } catch (error) { setMessage(error instanceof Error ? error.message : t.unableLoadBranches) }
  }, [t.loadingBranches, t.signInBranches, t.noMembership, t.unableLoadBranches])
  useEffect(() => { void load() }, [load])
  const save = async () => {
    if (!form.name.trim() || !company || saving) return
    setSaving(true)
    const payload = {name: form.name.trim(), address: form.address.trim() || null, phone: form.phone.trim() || null}
    const query = editingId
      ? getSupabase().from('branches').update(payload).eq('id', editingId).eq('company_id', company)
      : getSupabase().from('branches').insert({company_id: company, ...payload})
    const {error} = await query
    setMessage(error ? error.message : t.branchSaved)
    if (!error) { setForm({name: '', address: '', phone: ''}); setEditingId(null); await load() }
    setSaving(false)
  }
  const editBranch = (branch: Branch) => {
    setEditingId(branch.id)
    setForm({name: branch.name, address: branch.address || '', phone: branch.phone || ''})
    setMessage('')
    window.scrollTo({top: 0, behavior: 'smooth'})
  }
  const cancelEdit = () => { setEditingId(null); setForm({name: '', address: '', phone: ''}); setMessage('') }
  return <main className="app"><div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{t.managerOrganization}</p><h1 className={styles.title}>{t.branches}</h1><p className={styles.subtitle}>{t.branchesHelp}</p></div></header>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{editingId ? editLabel : t.addBranch}</h2><p>{editingId ? editHelp : t.addBranchHelp}</p></div><span className={styles.panelIcon}><Building2 size={21}/></span></header><div className={styles.formGrid}><label className={styles.field}>{t.branchName}<input placeholder={t.mainBranch} value={form.name} onChange={event => setForm({...form, name: event.target.value})}/></label><label className={styles.field}>{t.streetAddress}<GoogleAddressInput placeholder={t.addressPlaceholder} value={form.address} autoComplete="street-address" onValueChange={value => setForm(current => ({...current,address:value}))}/></label><label className={styles.field}>{t.phone}<input type="tel" placeholder="(000) 000-0000" value={form.phone} onChange={event => setForm({...form, phone: event.target.value})}/></label><div className={styles.formActions}><button className={styles.saveButton} disabled={saving || !form.name.trim()} onClick={save}>{editingId ? <Pencil size={18}/> : <Plus size={18}/>} {saving ? t.saving : editingId ? updateLabel : t.saveBranch}</button>{editingId && <button className={styles.cancelButton} type="button" onClick={cancelEdit}><X size={18}/>{t.cancel}</button>}</div></div></section>
    {message && <p className={styles.status} role="status" aria-live="polite">{message}</p>}<h2 className={styles.sectionLabel}>{t.branchLocations}</h2><section className={styles.list} aria-label={t.branchLocations}>{branches.map(branch => <article className={styles.rowCard} key={branch.id}><span className={styles.locationIcon}><MapPin size={20}/></span><div className={styles.identity}><h2>{branch.name}</h2><p>{branch.address || t.addressNotConfigured}</p>{branch.phone && <p>{branch.phone}</p>}</div><span className={styles.statusBadge} data-status={branch.active === false ? 'revoked' : 'active'}>{branch.active === false ? t.inactive : t.active}</span><button className={styles.iconButton} type="button" onClick={() => editBranch(branch)} aria-label={`${editLabel}: ${branch.name}`}><Pencil size={17}/></button></article>)}{!branches.length && !message && <section className={styles.empty}><span><MapPin size={24}/></span><h2>{t.noBranches}</h2><p>{t.noBranchesHelp}</p></section>}</section>
  </div></main>
}
