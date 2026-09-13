'use client'

import {useState} from 'react'
import {MapPin, Search, UserPlus, X} from 'lucide-react'
import nextDynamic from 'next/dynamic'
import GoogleAddressInput from '../google-address-input'
import styles from './routes.module.css'
import ui from './new-route-ui.module.css'
import type {OriginMode} from './routes-model'

const LocationConfirmMap = nextDynamic(() => import('../location-confirm-map'), {ssr: false})

// Route details: a small vertical timeline ties the starting point (hollow
// dot) to the destination (filled pin) so the two read as one path instead
// of two unrelated blocks, plus the optional/contact fields and PO/priority/
// notes collapsed under "More details".
export default function NewRouteDetails(p: any) {
  const {locale,c,form,setForm,originMode,setOriginSource,oc,defaultBranch,contacts,pendingLocation,setPendingLocation,useConfirmedDestination,updateDestination,destinationSuggestions,selectDestinationContact,selectExternalDestination,searchContext,saveContactOpen,setSaveContactOpen,contactSaveMessage,newContactName,setNewContactName,savingContact,saveDestinationAsContact,selectedContact} = p

  const originLabel = locale==='es' ? 'Origen' : locale==='fr' ? 'Origine' : 'Origin'
  const destLabel = locale==='es' ? 'Destino' : locale==='fr' ? 'Destination' : 'Destination'
  const whoReceivesLabel = locale==='es' ? '¿Quién recibe?' : locale==='fr' ? 'Qui reçoit ?' : 'Who receives it?'

  // Picking a saved contact vs. searching a brand-new address are two
  // different jobs, so they get two different fields instead of one field
  // trying to be both: a saved contact never needs to touch Google at all
  // (it's already geocoded), and a new address gets Google's real live
  // search instead of being displaced by it. Defaults to "contact" only
  // when this branch actually has one saved - otherwise there is nothing
  // to pick from, so search is the only useful starting point.
  const [destinationSource, setDestinationSource] = useState<'contact' | 'address'>(destinationSuggestions.length ? 'contact' : 'address')
  const contactLabel = locale==='es' ? 'Contacto guardado' : locale==='fr' ? 'Contact enregistré' : 'Saved contact'
  const addressLabel = locale==='es' ? 'Dirección nueva' : locale==='fr' ? 'Nouvelle adresse' : 'New address'

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
            <legend className={ui.timelineTag}>{originLabel}</legend>
            <div className={styles.segmented}>{(['branch','previous','custom'] as OriginMode[]).map(mode => <button className={originMode === mode ? styles.segmentActive : ''} type="button" key={mode} aria-pressed={originMode === mode} onClick={() => setOriginSource(mode)}>{oc[mode]}</button>)}</div>
            {/* A full 49px select control here would offer to pick among
                every branch the company has, but "default branch" always
                means this session's own branch - each branch runs
                separately, so this is always a read-only line, never a
                dropdown onto some other branch. */}
            {originMode === 'branch' && (
              defaultBranch?.address ? (
                <div className={ui.compactValue}><MapPin size={14}/><span>{defaultBranch.address}</span></div>
              ) : defaultBranch ? (
                <div className={ui.compactValue} style={{color: 'var(--danger, #c0392b)'}}><MapPin size={14}/><span>{defaultBranch.name} — {oc.noBranchAddress}</span></div>
              ) : (
                <div className={ui.compactValue}><MapPin size={14}/><span>{oc.chooseBranch}</span></div>
              )
            )}
            {originMode === 'previous' && <div className={styles.inputWrap}><MapPin size={18}/><input value={form.origin} onChange={event => setForm((current: any) => ({...current, origin:event.target.value}))} placeholder={oc.noPrevious}/></div>}
            {originMode === 'contact' && <div className={styles.inputWrap}><MapPin size={18}/><select value={form.origin} onChange={event => setForm((current: any) => ({...current, origin:event.target.value}))}><option value="">{oc.chooseContact}</option>{(contacts||[]).map((contact: any) => <option key={contact.id} value={contact.address}>{contact.company_name}</option>)}</select></div>}
            {originMode === 'custom' && <div className={styles.inputWrap}><MapPin size={18}/><GoogleAddressInput value={form.origin} placeholder={c.originPlaceholder} onValueChange={value => setForm((current: any) => ({...current, origin:value}))}/></div>}
          </fieldset>

          <div>
            <span className={`${ui.timelineTag} ${ui.timelineTagDest}`}>{destLabel}</span>
            {/* A return always goes back to this session's own branch - not
                a picker onto some other branch in the same company, which
                is exactly the cross-branch mixing that shouldn't happen. */}
            {form.type==='return' ? <label className={styles.field}><span>{locale==='es'?'Sucursal de regreso':'Return branch'}</span><div className={ui.compactValue}><MapPin size={14}/><span>{defaultBranch?.address || (defaultBranch ? `${defaultBranch.name} — ${oc.noBranchAddress}` : oc.chooseBranch)}</span></div></label> : <div className={ui.destCard}>
              <label className={styles.field}>
                <span>{form.type==='pickup'?c.pickupFrom:c.deliveryTo}</span>
                {destinationSuggestions.length > 0 && (
                  <div className={styles.segmented}>
                    <button type="button" className={destinationSource === 'contact' ? styles.segmentActive : ''} aria-pressed={destinationSource === 'contact'} onClick={() => { setDestinationSource('contact'); if (!selectedContact) setForm((current: any) => ({...current, destination: ''})) }}>{contactLabel}</button>
                    <button type="button" className={destinationSource === 'address' ? styles.segmentActive : ''} aria-pressed={destinationSource === 'address'} onClick={() => setDestinationSource('address')}>{addressLabel}</button>
                  </div>
                )}
                {destinationSource === 'contact' && destinationSuggestions.length > 0 ? (
                  <div className={styles.inputWrap}>
                    <MapPin size={18}/>
                    <select value={selectedContact ? form.contact_id : ''} onChange={event => {
                      const suggestion = destinationSuggestions.find((item: {id: string}) => item.id === event.target.value)
                      if (suggestion) selectDestinationContact(suggestion)
                    }}>
                      <option value="">{oc.chooseContact}</option>
                      {destinationSuggestions.map((suggestion: {id: string; primary: string}) => <option key={suggestion.id} value={suggestion.id}>{suggestion.primary}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className={`${styles.inputWrap} ${ui.destinationWrap}`}>
                    <Search size={18}/>
                    {/* No localSuggestions here on purpose - once a saved
                        contact is one tap away above, this field's only job
                        is a genuinely new address, so Google's own live,
                        as-you-type search stays on instead of being
                        displaced by the local-suggestions fallback. */}
                    <GoogleAddressInput value={form.destination} placeholder={c.searchPlaceholder} onValueChange={updateDestination} onSelectSearchSuggestion={selectExternalDestination} searchContext={searchContext} searchLabel={locale==='es'?'Buscar':'Search'}/>
                    {/* Floats on the field's own top border like a tag, instead
                        of sitting beside the input and eating into its width -
                        the field keeps its full width to read long addresses.
                        The X clears both the contact and the address in one
                        step, so picking the wrong saved place doesn't require
                        manually erasing the text field first. */}
                    {selectedContact && <div className={ui.savedContactBadge}>
                      <span>{selectedContact.company_name}</span>
                      <button type="button" className={ui.savedContactClose} aria-label={locale==='es'?'Quitar contacto':locale==='fr'?'Retirer le contact':'Clear contact'} onClick={() => setForm((current: any) => ({...current, destination: '', destination_label: '', contact_id: '', destination_phone: '', stop_contact_name: ''}))}><X size={11}/></button>
                    </div>}
                  </div>
                )}
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
              {/* Contact name/phone grouped under the destination they
                  belong to, instead of two fields sitting loose after the
                  address with nothing visually tying them back to it. */}
              {form.type==='delivery'&&<div className={ui.contactBlock}>
                <p className={ui.contactBlockLabel}>{whoReceivesLabel} <em style={{textTransform:'none',fontWeight:600,color:'#94a3b8'}}>{c.optional}</em></p>
                <div className={ui.deliveryDetailsRow}>
                  <label className={styles.field}><span>{locale==='es'?'Nombre':'Name'}</span><input value={form.stop_contact_name} placeholder={locale==='es'?'Quién recibe':'Who receives it'} onChange={event => setForm((current: any) => ({...current, stop_contact_name:event.target.value}))}/></label>
                  <label className={styles.field}><span>{locale==='es'?'Teléfono':'Phone'}</span><input type="tel" value={form.destination_phone} placeholder="(000) 000-0000" onChange={event => setForm((current: any) => ({...current, destination_phone:event.target.value}))}/></label>
                </div>
              </div>}
            </div>}
          </div>
        </div>
      </div>
    </div>
  )
}
