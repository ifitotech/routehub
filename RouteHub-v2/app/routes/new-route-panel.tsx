'use client'

import {Bell, Check, CheckCircle2, Package, Plus, Store, Truck, X} from 'lucide-react'
import styles from './routes.module.css'
import ui from './new-route-ui.module.css'
import {routeTypes, typeLabel} from './routes-model'
import NewRouteDetails from './new-route-details'
import NewRouteAssignment from './new-route-assignment'
import NewRouteDriverPicker from './new-route-driver-picker'
import {branchLocation} from './routes-model'
import type {useRoutesWorkspace} from './routes-workspace'

type Workspace = ReturnType<typeof useRoutesWorkspace>

// Same props the form pieces read, minus the map-preview state that used to
// live in a modal's own mapColumn - the route preview now renders in the
// dispatch board's persistent map column instead of a second map here.
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
  const {saving, setOpen, justCreated, locale, c, openBuilder, form, setForm, defaultBranch, save, setSelectedDestinationLocation} = p
  const notice = locale==='es' ? 'El conductor será notificado' : locale==='fr' ? 'Le conducteur sera notifié' : 'Driver will be notified'
  const assignLabel = form.type==='pickup'
    ? (locale==='es'?'Asignar recogida':locale==='fr'?'Attribuer la collecte':'Assign pickup')
    : form.type==='return'
      ? (locale==='es'?'Asignar regreso':locale==='fr'?'Attribuer le retour':'Assign return')
      : (locale==='es'?'Asignar entrega':locale==='fr'?'Attribuer la livraison':'Assign delivery')

  return (
    <div className={ui.inlinePanel}>
      <div className={ui.inlinePanelHeader}>
        <div className={ui.titleRow}>
          <div><p className={styles.eyebrow}>{c.newAssignment.toUpperCase()}</p><h2>{locale==='es' ? 'Nueva ruta' : locale==='fr' ? 'Nouvel itinéraire' : 'New route'}</h2>{defaultBranch?.name && <p>{defaultBranch.name}</p>}</div>
          <button className={styles.closeButton} type="button" aria-label={c.close} disabled={saving} onClick={() => setOpen(false)}><X size={20}/></button>
        </div>
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
        {/* Route type used to be three tall cards spanning the full width
            on their own row, which cost as much vertical space as the
            entire Driver section below it. Compact now, and sharing a row
            with the driver picker instead of Driver living only in the
            Assignment panel - that saved a whole panel section's height. */}
        <div className={ui.typeDriverRow}>
          <div className={ui.typeCards}>{routeTypes.map(type => <button className={form.type === type.value ? ui.typeCardActive : ui.typeCard} type="button" key={type.value} aria-pressed={form.type === type.value} onClick={() => {
            if(type.value === 'return') {
              setSelectedDestinationLocation(branchLocation(defaultBranch))
              setForm((current: any) => ({...current, type:'return', destination:defaultBranch?.address || defaultBranch?.name || '', destination_label:defaultBranch?.name||'', destination_phone:'', contact_id:''}))
              return
            }
            setForm((current: any) => ({...current, type:type.value}))
          }}>{form.type === type.value ? <span className={ui.typeCheck} aria-hidden="true"><Check size={12}/></span> : null}<span className={ui.typeCardIcon}>{type.value==='pickup'?<Package size={18}/>:type.value==='return'?<Store size={18}/>:<Truck size={18}/>}</span><span className={ui.typeCardTitle}>{typeLabel(type.value,c)}</span></button>)}</div>
          <NewRouteDriverPicker {...p} />
        </div>

        <div className={ui.detailsGrid}>
          <NewRouteDetails {...p} />
          <NewRouteAssignment {...p} />
        </div>

        <div className={ui.formFooter}>
          <span className={ui.footerNotice}><Bell size={14}/>{notice}</span>
          <div className={ui.footerActions}>
            <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => setOpen(false)}>{locale==='es' ? 'Cancelar' : locale==='fr' ? 'Annuler' : 'Cancel'}</button>
            <button className={styles.publishButton} type="button" disabled={saving || !form.driver_id || !form.destination.trim()} onClick={save}>{saving ? c.publishing : <><Truck size={19}/>{assignLabel}</>}</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
