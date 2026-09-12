'use client'

import {Bell, Check, CheckCircle2, Package, Plus, Store, Truck, X} from 'lucide-react'
import styles from './routes.module.css'
import ui from './new-route-ui.module.css'
import {routeTypes, typeLabel} from './routes-model'
import NewRouteDetails from './new-route-details'
import NewRouteAssignment from './new-route-assignment'
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
  const {saving, setOpen, justCreated, locale, c, openBuilder, form, setForm, defaultBranch, setSelectedDestinationLocation, save} = p
  const notice = locale==='es' ? 'El conductor será notificado' : locale==='fr' ? 'Le conducteur sera notifié' : 'Driver will be notified'
  const assignLabel = form.type==='pickup'
    ? (locale==='es'?'Asignar recogida':locale==='fr'?'Attribuer la collecte':'Assign pickup')
    : form.type==='return'
      ? (locale==='es'?'Asignar regreso':locale==='fr'?'Attribuer le retour':'Assign return')
      : (locale==='es'?'Asignar entrega':locale==='fr'?'Attribuer la livraison':'Assign delivery')

  return (
    <div className={ui.inlinePanel}>
      <div className={ui.inlinePanelHeader}>
        {/* Eyebrow + title + branch used to be three separate lines, which
            cost more header height than the context is worth once the
            branch name is already visible everywhere else in the shell -
            title and branch now share one compact line. */}
        <div className={ui.titleRow}>
          <div className={ui.compactTitle}><h2>{locale==='es' ? 'Nueva ruta' : locale==='fr' ? 'Nouvel itinéraire' : 'New route'}</h2>{defaultBranch?.name && <span>{defaultBranch.name}</span>}</div>
          <button className={styles.closeButton} type="button" aria-label={c.close} disabled={saving} onClick={() => setOpen(false)}><X size={20}/></button>
        </div>
      </div>
      {justCreated ? <div className={styles.successPanel}>
        <div className={styles.successIcon}><CheckCircle2 size={34}/></div>
        <h3>{c.published}</h3>
        <p>{locale==='es' ? 'La ruta ya aparece para el conductor asignado.' : 'The route is now available to the assigned driver.'}</p>
        <div className={styles.successActions}>
          <button className={styles.secondaryButton} type="button" onClick={() => setOpen(false)}>{locale==='es' ? 'Listo' : 'Done'}</button>
          <button className={styles.primaryButton} type="button" onClick={() => openBuilder()}><Plus size={18}/>{locale==='es' ? 'Añadir otra' : 'Add another'}</button>
        </div>
      </div> : <div className={ui.inlinePanelBody}>
        {/* True two-column layout instead of two stacked rows: Route type +
            Route details flow together down the left column, Assignment
            fills the right column independently. Putting Route details in
            its own full-width row below a shared row left it waiting on
            whichever side of that row was taller (Assignment), which opened
            up a large empty gap above it whenever Assignment ran long. */}
        <div className={ui.mainGrid}>
          <div className={ui.mainLeftCol}>
            <div className={ui.typeCards}>{routeTypes.map(type => <button className={form.type === type.value ? ui.typeCardActive : ui.typeCard} type="button" key={type.value} aria-pressed={form.type === type.value} onClick={() => {
              if(type.value === 'return') {
                setSelectedDestinationLocation(branchLocation(defaultBranch))
                setForm((current: any) => ({...current, type:'return', destination:defaultBranch?.address || defaultBranch?.name || '', destination_label:defaultBranch?.name||'', destination_phone:'', contact_id:''}))
                return
              }
              setForm((current: any) => ({...current, type:type.value}))
            }}>{form.type === type.value ? <span className={ui.typeCheck} aria-hidden="true"><Check size={12}/></span> : null}<span className={ui.typeCardIcon}>{type.value==='pickup'?<Package size={18}/>:type.value==='return'?<Store size={18}/>:<Truck size={18}/>}</span><span className={ui.typeCardTitle}>{typeLabel(type.value,c)}</span><span className={ui.typeCardDesc}>{type.value==='pickup' ? (locale==='es'?'Recoger materiales':'Collect materials') : type.value==='return' ? (locale==='es'?'Regresar a tu sucursal':'Back to your branch') : (locale==='es'?'Entregar al cliente':'Deliver to customer')}</span></button>)}</div>
            <NewRouteDetails {...p} />
            {/* Sits at the true bottom of the left column - below Route
                details, whatever height it grows to once "More details" is
                open there too - instead of in the shorter Assignment
                column, where it used to sit above a large empty gap. */}
            <div className={ui.formFooter}>
              <span className={ui.footerNotice}><Bell size={14}/>{notice}</span>
              <div className={ui.footerActions}>
                <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => setOpen(false)}>{locale==='es' ? 'Cancelar' : locale==='fr' ? 'Annuler' : 'Cancel'}</button>
                <button className={styles.publishButton} type="button" disabled={saving || !form.driver_id || !form.destination.trim()} onClick={save}>{saving ? c.publishing : <><Truck size={19}/>{assignLabel}</>}</button>
              </div>
            </div>
          </div>
          <NewRouteAssignment {...p} />
        </div>
      </div>}
    </div>
  )
}
