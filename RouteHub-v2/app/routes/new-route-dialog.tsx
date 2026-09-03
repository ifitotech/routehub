'use client'

import {CheckCircle2, MapPin, Package, Plus, Route as RouteIcon, Truck, Undo2, UserRound, Users, X} from 'lucide-react'
import nextDynamic from 'next/dynamic'
import styles from './routes.module.css'
import contrast from './route-contrast.module.css'
import ui from './new-route-ui.module.css'
import {branchLocation, driverDetails, routeTypes, typeLabel} from './routes-model'
import NewRouteFields from './new-route-fields'

const OperationsMap = nextDynamic(() => import('../operations-map'), {ssr: false})

export default function NewRouteDialog(d: any) {
  const p = d
  if (!p.open) return null
  const {saving, setOpen, justCreated, locale, c, openBuilder, previewOpen, setPreviewOpen, form, setForm, selectedContact, defaultBranch, todayValue, drivers, insertBeforeId, setInsertBeforeId, priorityRoutes, planningMapRoutes, setSelectedDestinationLocation} = p
  const selectedDriver = drivers?.find((driver: {user_id: string}) => driver.user_id === form.driver_id)
  const typeDesc = (value: string) => value==='pickup' ? (locale==='es'?'Recoger en un punto':'Pick up items from a location') : value==='return' ? (locale==='es'?'Regresar a la sucursal':'Return to store') : (locale==='es'?'Entregar al cliente':'Deliver to customer')
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setOpen(false) }}>
      <section className={styles.builder} role="dialog" aria-modal="true" aria-labelledby="new-route-title">
        <div className={`${styles.builderHeader} ${contrast.header}`}>
          <div><p className={styles.eyebrow}>{c.newAssignment.toUpperCase()}</p><h2 id="new-route-title">{locale==='es' ? 'Nueva ruta' : locale==='fr' ? 'Nouvel itinéraire' : 'New route'}</h2><p className={styles.builderSubtitle}>{locale==='es' ? 'Crea y asigna una nueva ruta' : locale==='fr' ? 'Créer et assigner un nouvel itinéraire' : 'Create and assign a new route'}</p></div>
          <button className={styles.closeButton} type="button" aria-label={c.close} disabled={saving} onClick={() => setOpen(false)}><X size={22}/></button>
        </div>
        {justCreated ? <div className={styles.successPanel}>
          <div className={styles.successIcon}><CheckCircle2 size={34}/></div>
          <h3>{c.published}</h3>
          <p>{locale==='es' ? 'La ruta ya aparece para el conductor asignado.' : 'The route is now available to the assigned driver.'}</p>
          <div className={styles.successActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => setOpen(false)}>{locale==='es' ? 'Listo' : 'Done'}</button>
            <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{locale==='es' ? 'Añadir otra' : 'Add another'}</button>
          </div>
        </div> : <div className={styles.builderBody}>
          <button type="button" className={styles.mobileMapButton} onClick={() => setPreviewOpen((value: boolean) => !value)}><MapPin size={16}/>{previewOpen ? (locale==='es' ? 'Ocultar mapa' : 'Hide map') : (locale==='es' ? 'Ver mapa' : 'View map')}</button>
          <div className={`${styles.mapColumn} ${previewOpen ? styles.mapColumnOpen : ''}`}>
            <section className={styles.previewCard}>
              <div className={styles.previewCardHeader}>
                <div><span className={styles.previewEyebrow}>ROUTE PREVIEW</span><h3>{locale==='es' ? 'Confirma las ubicaciones' : 'Confirm locations'}</h3></div>
                <MapPin size={19}/>
              </div>
              <OperationsMap routes={planningMapRoutes} locale={locale} interactive/>
            </section>
          </div>
          <div className={`${styles.formColumn} ${contrast.form}`}>
            <section className={styles.builderSection}>
              <div className={ui.routeTypeDriverRow}>
                <div>
                  <div className={styles.builderSectionHeader}><span className={styles.sectionNumber}>1</span><div><h3>{locale==='es' ? 'Tipo de ruta' : 'Route type'}</h3></div></div>
                  <div className={ui.typeCards}>{routeTypes.map(type => <button className={form.type === type.value ? ui.typeCardActive : ui.typeCard} type="button" key={type.value} aria-pressed={form.type === type.value} onClick={() => {
                    if(type.value === 'return') {
                      setSelectedDestinationLocation(branchLocation(defaultBranch))
                      setForm((current: any) => ({...current, type:'return', destination:defaultBranch?.address || defaultBranch?.name || '', destination_label:defaultBranch?.name||'', destination_phone:'', contact_id:''}))
                      return
                    }
                    setForm((current: any) => ({...current, type:type.value}))
                  }}><span className={ui.typeCardIcon}>{type.value==='pickup'?<Package size={22}/>:type.value==='return'?<Undo2 size={22}/>:<Truck size={22}/>}</span><span className={ui.typeCardTitle}>{typeLabel(type.value,c)}</span><span className={ui.typeCardDesc}>{typeDesc(type.value)}</span></button>)}</div>
                </div>
                <label className={`${styles.field} ${styles.driverField}`}><span>{c.driver}</span><div className={styles.inputWrap}><UserRound size={18}/><select value={form.driver_id} onChange={event => setForm((current: any) => ({...current, driver_id: event.target.value}))}><option value="">{c.chooseDriver}</option>{(drivers||[]).map((driver: any,index: number) => { const fallback=`${c.driver} ${index+1}`; const details = driverDetails(driver,driver.role==='driver'?c.teamDriver:fallback); const isPrimary=driver.user_id===defaultBranch?.primary_driver_id; const roleName=isPrimary?(locale==='es'?'Conductor principal':'Primary Driver'):(driver.role||c.teamDriver).replaceAll('_',' '); return <option key={driver.user_id} value={driver.user_id}>{`${details.name||fallback} — ${roleName}`}</option> })}</select></div></label>
              </div>
              {selectedContact && <section className={styles.selectedContactCard}>
                <div className={styles.selectedContactIcon}><Users size={18}/></div>
                <div className={styles.selectedContactInfo}><strong>{selectedContact.company_name}</strong><span>{selectedContact.address}</span></div>
              </section>}
              {form.driver_id && form.date === todayValue && priorityRoutes?.length > 0 && <label className={styles.field}><span>{locale==='es' ? 'Posición en la ruta' : 'Position in route'}</span><div className={styles.inputWrap}><RouteIcon size={18}/><select value={insertBeforeId} onChange={event => setInsertBeforeId(event.target.value)}><option value="">{locale==='es' ? 'Agregar al final' : 'Add to end'}</option>{priorityRoutes.map((route: any) => <option key={route.id} value={route.id}>{route.destination_name || route.destination_address}</option>)}</select></div></label>}
            </section>
            <NewRouteFields {...p} />
          </div>
        </div>}
      </section>
    </div>
  )
}
