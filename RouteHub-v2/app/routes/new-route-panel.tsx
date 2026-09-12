'use client'

import {Check, CheckCircle2, Package, Plus, Route as RouteIcon, Store, Truck, UserRound, Users, X} from 'lucide-react'
import styles from './routes.module.css'
import ui from './new-route-ui.module.css'
import {driverDetails, routeTypes, typeLabel} from './routes-model'
import NewRouteFields from './new-route-fields'
import {branchLocation} from './routes-model'
import type {useRoutesWorkspace} from './routes-workspace'

type Workspace = ReturnType<typeof useRoutesWorkspace>

// Same props NewRouteDialog reads, minus the map-preview state that used to
// live in this dialog's own mapColumn - the route preview now renders in
// the dispatch board's persistent map column instead of a second map here.
type NewRoutePanelProps = Pick<Workspace,
  | 'saving' | 'setOpen' | 'justCreated' | 'locale' | 'c' | 'openBuilder'
  | 'form' | 'setForm' | 'selectedContact'
  | 'originMode' | 'setOriginSource' | 'selectDriver' | 'oc' | 'branches' | 'contacts'
  | 'defaultBranch' | 'detailsOpen' | 'setDetailsOpen' | 'todayValue' | 'drivers' | 'save'
  | 'pendingLocation' | 'setPendingLocation' | 'useConfirmedDestination' | 'updateDestination'
  | 'destinationSuggestions' | 'selectDestinationContact' | 'selectExternalDestination'
  | 'searchContext' | 'selectedDestinationLocation' | 'setSelectedDestinationLocation'
  | 'insertBeforeId' | 'setInsertBeforeId' | 'priorityRoutes' | 'saveContactOpen'
  | 'setSaveContactOpen' | 'contactSaveMessage' | 'setContactSaveMessage' | 'newContactName'
  | 'setNewContactName' | 'savingContact' | 'saveDestinationAsContact'
>

export default function NewRoutePanel(p: NewRoutePanelProps) {
  const {saving, setOpen, justCreated, locale, c, openBuilder, form, setForm, selectedContact, defaultBranch, todayValue, drivers, insertBeforeId, setInsertBeforeId, priorityRoutes, setSelectedDestinationLocation} = p
  const typeDesc = (value: string) => value==='pickup' ? (locale==='es'?'Recoger en un punto':'Pick up items from a location') : value==='return' ? (locale==='es'?'Regresar a la tienda':'Return to store') : (locale==='es'?'Entregar al cliente':'Deliver to customer')

  return (
    <div className={ui.inlinePanel}>
      <div className={ui.inlinePanelHeader}>
        <div><p className={styles.eyebrow}>{c.newAssignment.toUpperCase()}</p><h2>{locale==='es' ? 'Nueva ruta' : locale==='fr' ? 'Nouvel itinéraire' : 'New route'}</h2></div>
        <button className={styles.closeButton} type="button" aria-label={c.close} disabled={saving} onClick={() => setOpen(false)}><X size={20}/></button>
      </div>
      {justCreated ? <div className={styles.successPanel}>
        <div className={styles.successIcon}><CheckCircle2 size={34}/></div>
        <h3>{c.published}</h3>
        <p>{locale==='es' ? 'La ruta ya aparece para el conductor asignado.' : 'The route is now available to the assigned driver.'}</p>
        <div className={styles.successActions}>
          <button className={styles.secondaryButton} type="button" onClick={() => setOpen(false)}>{locale==='es' ? 'Listo' : 'Done'}</button>
          <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{locale==='es' ? 'Añadir otra' : 'Add another'}</button>
        </div>
      </div> : <div className={ui.inlinePanelBody}>
        <section className={styles.builderSection}>
          {/* One header for both columns below, instead of "Route type"
              owning its own header while Driver only had a small inline
              label - that mismatch in header height was what pushed the
              driver select out of line with the type cards beside it. */}
          <div className={styles.builderSectionHeader}><span className={styles.sectionNumber}>1</span><div><h3>{locale==='es' ? 'Tipo de ruta y conductor' : locale==='fr' ? 'Type d’itinéraire et conducteur' : 'Route type & driver'}</h3></div></div>
          <div className={ui.routeTypeDriverRow}>
            <div className={ui.typeCards}>{routeTypes.map(type => <button className={form.type === type.value ? ui.typeCardActive : ui.typeCard} type="button" key={type.value} aria-pressed={form.type === type.value} onClick={() => {
                if(type.value === 'return') {
                  setSelectedDestinationLocation(branchLocation(defaultBranch))
                  setForm((current: any) => ({...current, type:'return', destination:defaultBranch?.address || defaultBranch?.name || '', destination_label:defaultBranch?.name||'', destination_phone:'', contact_id:''}))
                  return
                }
                setForm((current: any) => ({...current, type:type.value}))
              }}>{form.type === type.value ? <span className={ui.typeCheck} aria-hidden="true"><Check size={12}/></span> : null}<span className={ui.typeCardIcon}>{type.value==='pickup'?<Package size={22}/>:type.value==='return'?<Store size={22}/>:<Truck size={22}/>}</span><span className={ui.typeCardTitle}>{typeLabel(type.value,c)}</span><span className={ui.typeCardDesc}>{typeDesc(type.value)}</span></button>)}</div>
            <label className={`${styles.field} ${styles.driverField}`}><span>{c.driver}</span><div className={styles.inputWrap}><UserRound size={18}/><select value={form.driver_id} onChange={event => setForm((current: any) => ({...current, driver_id: event.target.value}))}><option value="">{c.chooseDriver}</option>{(drivers||[]).map((driver: any,index: number) => { const fallback=`${c.driver} ${index+1}`; const details = driverDetails(driver,driver.role==='driver'?c.teamDriver:fallback); const isPrimary=driver.user_id===defaultBranch?.primary_driver_id; return <option key={driver.user_id} value={driver.user_id}>{`${details.name||fallback}${isPrimary?' — Primary Driver':''}`}</option> })}</select></div></label>
          </div>
          {selectedContact && <section className={styles.selectedContactCard}>
            <div className={styles.selectedContactIcon}><Users size={18}/></div>
            <div className={styles.selectedContactInfo}><strong>{selectedContact.company_name}</strong><span>{selectedContact.address}</span></div>
          </section>}
          {form.driver_id && form.date === todayValue && priorityRoutes?.length > 0 && <label className={styles.field}><span>{locale==='es' ? 'Posición en la ruta' : 'Position in route'}</span><div className={styles.inputWrap}><RouteIcon size={18}/><select value={insertBeforeId} onChange={event => setInsertBeforeId(event.target.value)}><option value="">{locale==='es' ? 'Agregar al final' : 'Add to end'}</option>{priorityRoutes.map((route: any) => <option key={route.id} value={route.id}>{route.destination_name || route.destination_address}</option>)}</select></div></label>}
        </section>
        <NewRouteFields {...p} />
      </div>}
    </div>
  )
}
