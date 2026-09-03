'use client'

import {CalendarDays, ChevronRight, Clock3, MapPin, Search, SlidersHorizontal, Truck, UserPlus} from 'lucide-react'
import nextDynamic from 'next/dynamic'
import GoogleAddressInput from '../google-address-input'
import styles from './routes.module.css'
import ui from './new-route-ui.module.css'
import {branchLocation, type OriginMode} from './routes-model'

const LocationConfirmMap = nextDynamic(() => import('../location-confirm-map'), {ssr: false})

export default function NewRouteFields(p: any) {
  const {locale,c,form,setForm,originMode,setOriginSource,oc,branches,contacts,defaultBranch,detailsOpen,setDetailsOpen,save,saving,setOpen,pendingLocation,setPendingLocation,useConfirmedDestination,updateDestination,destinationSuggestions,selectDestinationContact,selectExternalDestination,searchContext,setSelectedDestinationLocation,saveContactOpen,setSaveContactOpen,contactSaveMessage,newContactName,setNewContactName,savingContact,saveDestinationAsContact,selectedContact} = p
  const branchForValue = (value: string) => branches?.find((branch: {address?: string | null; name: string}) => (branch.address || branch.name) === value)
  return (
    <>
      <section className={styles.builderSection}>
        <div className={styles.builderSectionHeader}><span className={styles.sectionNumber}>2</span><div><h3>{locale==='es' ? 'Ubicaciones' : locale==='fr' ? 'Emplacements' : 'Locations'}</h3></div></div>
        <fieldset className={styles.fieldset}>
          <legend>{c.startingPoint}</legend>
          <div className={styles.segmented}>{(['branch','previous','contact','custom'] as OriginMode[]).map(mode => <button className={originMode === mode ? styles.segmentActive : ''} type="button" key={mode} aria-pressed={originMode === mode} onClick={() => setOriginSource(mode)}>{oc[mode]}</button>)}</div>
          {originMode === 'branch' && <div className={styles.inputWrap}><MapPin size={18}/><select value={form.origin} onChange={event => setForm((current: any) => ({...current, origin:event.target.value}))}><option value="">{oc.chooseBranch}</option>{(branches||[]).map((branch: any) => <option key={branch.id} value={branch.address || branch.name}>{branch.name}</option>)}</select></div>}
          {originMode === 'previous' && <div className={styles.inputWrap}><MapPin size={18}/><input value={form.origin} onChange={event => setForm((current: any) => ({...current, origin:event.target.value}))} placeholder={oc.noPrevious}/></div>}
          {originMode === 'contact' && <div className={styles.inputWrap}><MapPin size={18}/><select value={form.origin} onChange={event => setForm((current: any) => ({...current, origin:event.target.value}))}><option value="">{oc.chooseContact}</option>{(contacts||[]).map((contact: any) => <option key={contact.id} value={contact.address}>{contact.company_name}</option>)}</select></div>}
          {originMode === 'custom' && <div className={styles.inputWrap}><MapPin size={18}/><GoogleAddressInput value={form.origin} placeholder={c.originPlaceholder} onValueChange={value => setForm((current: any) => ({...current, origin:value}))}/></div>}
        </fieldset>
        {form.type==='return' ? <label className={styles.field}><span>{locale==='es'?'Sucursal de regreso':'Return branch'}</span><div className={styles.inputWrap}><MapPin size={18}/><select value={form.destination} onChange={event=>{const branch=branchForValue(event.target.value);setSelectedDestinationLocation(branchLocation(branch));setForm((current: any)=>({...current,destination:event.target.value,destination_label:branch?.name||'',destination_phone:'',contact_id:''}))}}>{(branches||[]).map((branch: any)=><option key={branch.id} value={branch.address||branch.name}>{branch.name}</option>)}</select></div></label> : <>
          <label className={styles.field}>
            <span>{form.type==='pickup'?c.pickupFrom:c.deliveryTo}</span>
            <div className={styles.inputWrap}><Search size={18}/><GoogleAddressInput value={form.destination} placeholder={c.searchPlaceholder} onValueChange={updateDestination} localSuggestions={destinationSuggestions} onSelectLocalSuggestion={selectDestinationContact} onSelectSearchSuggestion={selectExternalDestination} searchContext={searchContext} searchLabel={locale==='es'?'Buscar':'Search'}/></div>
          </label>
          {pendingLocation && <section className={styles.locationConfirmation}>
            <div><strong>{pendingLocation.name || pendingLocation.formattedAddress}</strong><span>{pendingLocation.formattedAddress}</span></div>
            <LocationConfirmMap coordinate={pendingLocation.coordinate} label={pendingLocation.name || pendingLocation.formattedAddress} onCoordinateChange={coordinate => setPendingLocation((current: any) => current ? {...current, coordinate} : current)}/>
            <div className={styles.locationConfirmationActions}><button type="button" className={styles.secondaryButton} onClick={() => setPendingLocation(null)}>{locale==='es'?'Cambiar':'Change'}</button><button type="button" className={styles.primaryButton} onClick={useConfirmedDestination}>{locale==='es'?'Usar esta ubicación':'Use this location'}</button></div>
          </section>}
          {!selectedContact && !pendingLocation && form.destination.trim() && <div className={styles.addContactBlock}>
            {!saveContactOpen ? <button type="button" className={styles.addContactButton} onClick={() => {setSaveContactOpen(true)}}><UserPlus size={17}/>{c.addToContacts}</button> : <div className={styles.saveContactPanel}>
              <label className={styles.field}><span>{c.contactName}</span><input value={newContactName} placeholder={c.contactNamePlaceholder} onChange={event => setNewContactName(event.target.value)}/></label>
              <button type="button" className={styles.primaryButton} disabled={!newContactName.trim() || savingContact} onClick={() => void saveDestinationAsContact()}>{savingContact ? c.savingContact : c.saveContact}</button>
            </div>}
          </div>}
          {contactSaveMessage && <small className={styles.contactSaveMessage}>{contactSaveMessage}</small>}
          {form.type==='pickup'&&<label className={styles.field}><span>{c.po}</span><input value={form.order_number} placeholder={c.poExample} onChange={event => setForm((current: any) => ({...current, order_number:event.target.value}))}/></label>}
        </>}
      </section>
      <section className={styles.builderSection}>
        <button className={styles.detailsToggle} type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((value: boolean) => !value)}>
          <span className={ui.detailsToggleLeft}><SlidersHorizontal size={17}/>{locale==='es' ? 'Más detalles' : 'More details'}</span>
          <span className={ui.detailsToggleSummary}><CalendarDays size={14}/>{form.date}<Clock3 size={14}/>{form.time || '--:--'}</span>
          <ChevronRight size={16} className={detailsOpen ? styles.detailsChevronOpen : ''}/>
        </button>
        {detailsOpen && <div className={styles.optionalDetails}>
          <div className={styles.splitFields}>
            <label className={styles.field}><span>{c.date}</span><div className={styles.inputWrap}><CalendarDays size={18}/><input type="date" value={form.date} onChange={event => setForm((current: any) => ({...current, date: event.target.value}))}/></div></label>
            <label className={styles.field}><span>{c.time}</span><div className={styles.inputWrap}><Clock3 size={18}/><input type="time" value={form.time} onChange={event => setForm((current: any) => ({...current, time: event.target.value}))}/></div></label>
          </div>
          {form.type!=='pickup'&&<label className={styles.field}><span>{c.po} <em>{c.optional}</em></span><input value={form.order_number} onChange={event => setForm((current: any) => ({...current, order_number: event.target.value}))}/></label>}
          <label className={styles.field}><span>{c.notes} <em>{c.optional}</em></span><textarea rows={3} value={form.notes} onChange={event => setForm((current: any) => ({...current, notes: event.target.value}))}/></label>
        </div>}
      </section>
      <div className={styles.builderFooter}>
        <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => setOpen(false)}>{locale==='es' ? 'Cancelar' : locale==='fr' ? 'Annuler' : 'Cancel'}</button>
        <button className={styles.publishButton} type="button" disabled={saving || !form.driver_id || !form.destination.trim()} onClick={save}>{saving ? c.publishing : <><Truck size={19}/>{c.publish}</>}</button>
      </div>
    </>
  )
}
