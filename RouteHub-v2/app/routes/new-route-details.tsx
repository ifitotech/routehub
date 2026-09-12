'use client'

import {ChevronRight, MapPin, Search, SlidersHorizontal, UserPlus, Users} from 'lucide-react'
import nextDynamic from 'next/dynamic'
import GoogleAddressInput from '../google-address-input'
import styles from './routes.module.css'
import ui from './new-route-ui.module.css'
import {branchLocation, type OriginMode} from './routes-model'

const LocationConfirmMap = nextDynamic(() => import('../location-confirm-map'), {ssr: false})

// Route details: a small vertical timeline ties the starting point (hollow
// dot) to the destination (filled pin) so the two read as one path instead
// of two unrelated blocks, plus the optional/contact fields and PO/priority/
// notes collapsed under "More details".
export default function NewRouteDetails(p: any) {
  const {locale,c,form,setForm,originMode,setOriginSource,oc,branches,contacts,detailsOpen,setDetailsOpen,pendingLocation,setPendingLocation,useConfirmedDestination,updateDestination,destinationSuggestions,selectDestinationContact,selectExternalDestination,searchContext,setSelectedDestinationLocation,saveContactOpen,setSaveContactOpen,contactSaveMessage,newContactName,setNewContactName,savingContact,saveDestinationAsContact,selectedContact} = p
  const branchForValue = (value: string) => branches?.find((branch: {address?: string | null; name: string}) => (branch.address || branch.name) === value)
  const moreDetailsSummary = locale==='es' ? 'Orden, prioridad y notas' : locale==='fr' ? 'Commande, priorité et notes' : 'Order number, priority and notes'

  return (
    <div>
      <h3 className={ui.sectionHeading}>{locale==='es' ? 'Detalles de la ruta' : locale==='fr' ? 'Détails de l’itinéraire' : 'Route details'}</h3>
      <div className={ui.timelineRow}>
        <div className={ui.timelineTrack}>
          <span className={ui.timelineDotEmpty} aria-hidden="true"/>
          <span className={ui.timelineLine} aria-hidden="true"/>
          <span className={ui.timelineDotFilled} aria-hidden="true"/>
        </div>
        <div className={ui.timelineContent}>
          <fieldset className={`${styles.fieldset} ${ui.originPrimary}`}>
            <legend>{c.startingPoint}</legend>
            <div className={styles.segmented}>{(['branch','previous','contact','custom'] as OriginMode[]).map(mode => <button className={originMode === mode ? styles.segmentActive : ''} type="button" key={mode} aria-pressed={originMode === mode} onClick={() => setOriginSource(mode)}>{oc[mode]}</button>)}</div>
            {originMode === 'branch' && <div className={styles.inputWrap}><MapPin size={18}/><select value={form.origin} onChange={event => setForm((current: any) => ({...current, origin:event.target.value}))}><option value="">{oc.chooseBranch}</option>{(branches||[]).map((branch: any) => <option key={branch.id} value={branch.address || branch.name}>{branch.name}</option>)}</select></div>}
            {originMode === 'previous' && <div className={styles.inputWrap}><MapPin size={18}/><input value={form.origin} onChange={event => setForm((current: any) => ({...current, origin:event.target.value}))} placeholder={oc.noPrevious}/></div>}
            {originMode === 'contact' && <div className={styles.inputWrap}><MapPin size={18}/><select value={form.origin} onChange={event => setForm((current: any) => ({...current, origin:event.target.value}))}><option value="">{oc.chooseContact}</option>{(contacts||[]).map((contact: any) => <option key={contact.id} value={contact.address}>{contact.company_name}</option>)}</select></div>}
            {originMode === 'custom' && <div className={styles.inputWrap}><MapPin size={18}/><GoogleAddressInput value={form.origin} placeholder={c.originPlaceholder} onValueChange={value => setForm((current: any) => ({...current, origin:value}))}/></div>}
          </fieldset>

          {form.type==='return' ? <label className={styles.field}><span>{locale==='es'?'Sucursal de regreso':'Return branch'}</span><div className={styles.inputWrap}><MapPin size={18}/><select value={form.destination} onChange={event=>{const branch=branchForValue(event.target.value);setSelectedDestinationLocation(branchLocation(branch));setForm((current: any)=>({...current,destination:event.target.value,destination_label:branch?.name||'',destination_phone:'',contact_id:''}))}}>{(branches||[]).map((branch: any)=><option key={branch.id} value={branch.address||branch.name}>{branch.name}</option>)}</select></div></label> : <div>
            <label className={styles.field}>
              <span>{form.type==='pickup'?c.pickupFrom:c.deliveryTo}</span>
              <div className={styles.inputWrap}><Search size={18}/><GoogleAddressInput value={form.destination} placeholder={c.searchPlaceholder} onValueChange={updateDestination} localSuggestions={destinationSuggestions} onSelectLocalSuggestion={selectDestinationContact} onSelectSearchSuggestion={selectExternalDestination} searchContext={searchContext} searchLabel={locale==='es'?'Buscar':'Search'}/></div>
            </label>
            {selectedContact && <section className={styles.selectedContactCard}>
              <div className={styles.selectedContactIcon}><Users size={18}/></div>
              <div className={styles.selectedContactInfo}><strong>{selectedContact.company_name}</strong><span>{selectedContact.address}</span></div>
            </section>}
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
            {form.type==='delivery'&&<div className={ui.deliveryDetailsRow}>
              <label className={styles.field}><span>{locale==='es'?'Nombre del contacto':'Contact name'} <em>{c.optional}</em></span><input value={form.stop_contact_name} placeholder={locale==='es'?'Quién recibe':'Who receives it'} onChange={event => setForm((current: any) => ({...current, stop_contact_name:event.target.value}))}/></label>
              <label className={styles.field}><span>{locale==='es'?'Teléfono del contacto':'Contact phone'} <em>{c.optional}</em></span><input type="tel" value={form.destination_phone} placeholder="(000) 000-0000" onChange={event => setForm((current: any) => ({...current, destination_phone:event.target.value}))}/></label>
            </div>}
          </div>}

          <div>
            <button className={styles.detailsToggle} type="button" aria-expanded={detailsOpen} aria-controls="route-more-details" onClick={event => { event.stopPropagation(); setDetailsOpen((value: boolean) => !value) }}>
              <span className={ui.detailsToggleLeft}><SlidersHorizontal size={17}/><span><span className={ui.detailsToggleTitle}>{locale==='es' ? 'Más detalles' : locale==='fr' ? 'Plus de détails' : 'More details'}</span><small className={ui.detailsToggleHint}>{moreDetailsSummary}</small></span></span>
              <ChevronRight size={16} className={detailsOpen ? styles.detailsChevronOpen : ''}/>
            </button>
            {detailsOpen && <div id="route-more-details" className={styles.optionalDetails}>
              {form.type!=='pickup'&&form.type!=='delivery'&&<label className={styles.field}><span>{c.po} <em>{c.optional}</em></span><input value={form.order_number} onChange={event => setForm((current: any) => ({...current, order_number: event.target.value}))}/></label>}
              <label className={styles.field}>
                <span>{locale==='es'?'Prioridad':locale==='fr'?'Priorité':'Priority'}</span>
                <select value={form.priority} onChange={event => setForm((current: any) => ({...current, priority: event.target.value}))}>
                  <option value="normal">{c.normal}</option>
                  <option value="priority">{c.priorityName}</option>
                  <option value="urgent">{c.urgent}</option>
                </select>
              </label>
            </div>}
          </div>
        </div>
      </div>
    </div>
  )
}
