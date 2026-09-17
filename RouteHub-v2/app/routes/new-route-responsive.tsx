'use client'

import {Package, Truck, Undo2, X} from 'lucide-react'
import styles from './new-route-responsive.module.css'
import NewRouteDetails from './new-route-details'
import NewRouteAssignment from './new-route-assignment'
import {routeTypes, typeLabel} from './routes-model'
import type {useRoutesWorkspace} from './routes-workspace'

type Workspace = ReturnType<typeof useRoutesWorkspace>

type NewRouteResponsiveProps = Pick<Workspace,
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

const typeIcons: Record<string, typeof Truck> = {
  delivery: Truck,
  pickup: Package,
  return: Undo2,
}

// Delivery leads - it's the common case, and the reference layout reads
// left to right from most to least used.
const typeOrder = ['delivery', 'pickup', 'return']

export default function NewRouteResponsive(p: NewRouteResponsiveProps) {
  const {saving, setOpen, justCreated, locale, c, form, setForm, defaultBranch, save} = p

  const assignLabel = form.type === 'pickup'
    ? (locale === 'es' ? 'Asignar recogida' : locale === 'fr' ? 'Attribuer la collecte' : 'Assign pickup')
    : form.type === 'return'
      ? (locale === 'es' ? 'Asignar regreso' : locale === 'fr' ? 'Attribuer le retour' : 'Assign return')
      : (locale === 'es' ? 'Asignar entrega' : locale === 'fr' ? 'Attribuer la livraison' : 'Assign delivery')

  const cards = typeOrder
    .map(value => routeTypes.find(entry => entry.value === value))
    .filter(Boolean) as typeof routeTypes

  return (
    <div className={styles.responsivePanel}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h2>{locale === 'es' ? 'Nueva ruta' : locale === 'fr' ? 'Nouvel itinéraire' : 'New route'}</h2>
          {defaultBranch?.name && <span className={styles.headerBranch}>{defaultBranch.name}</span>}
        </div>
        <button
          className={styles.closeBtn}
          onClick={() => setOpen(false)}
          disabled={saving}
          aria-label={c.close}
          type="button"
        >
          <X size={22}/>
        </button>
      </div>

      {justCreated ? (
        <div className={styles.successPanel}>
          {locale === 'es' ? 'Ruta creada' : locale === 'fr' ? 'Itinéraire créé' : 'Route created'}
        </div>
      ) : (
        <>
          <div className={styles.content}>
            <div className={styles.section}>
              <p className={styles.sectionLabel}>{c.routeType}</p>
              <div className={styles.typeCardGrid} role="radiogroup" aria-label={c.routeType}>
                {cards.map(entry => {
                  const Icon = typeIcons[entry.value] || Truck
                  const active = form.type === entry.value
                  return (
                    <button
                      key={entry.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={active ? `${styles.typeCard} ${styles.typeCardActive}` : styles.typeCard}
                      onClick={() => setForm((current: any) => ({...current, type: entry.value}))}
                    >
                      <span className={styles.typeCardIcon}><Icon size={20}/></span>
                      <span className={styles.typeCardLabel}>{typeLabel(entry.value, c)}</span>
                      <span className={styles.typeRadio}/>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* NewRouteDetails renders its own "Route details" heading. */}
            <NewRouteDetails {...p} />
          </div>

          <div className={styles.sidebar}>
            <p className={styles.sectionLabel}>
              {locale === 'es' ? 'Asignar' : locale === 'fr' ? 'Attribuer' : 'Assign'}
            </p>

            <div className={styles.assignFields}>
              <NewRouteAssignment {...p} />
            </div>

            <div className={styles.footer}>
              <button
                className={styles.btnCancel}
                onClick={() => setOpen(false)}
                disabled={saving}
                type="button"
              >
                {locale === 'es' ? 'Cancelar' : locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                className={styles.btnSubmit}
                onClick={save}
                disabled={saving || !form.type}
                type="button"
              >
                {saving ? `${c.publishing}` : assignLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
