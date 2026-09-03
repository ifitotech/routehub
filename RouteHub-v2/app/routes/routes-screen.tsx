'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {MapPin, Plus, Route as RouteIcon, Users} from 'lucide-react'
import ManagerShell from '../manager/manager-shell'
import NewRouteDialog from './new-route-dialog'
import styles from './routes.module.css'
import {useRoutesWorkspace} from './routes-workspace'

export default function Routes() {
  const w = useRoutesWorkspace()
  const {c, locale, t, defaultBranch, open, saving, justCreated, previewOpen, form, setForm, selectedContact, originMode, detailsOpen, setDetailsOpen, todayValue, oc, branches, contacts, drivers, save, pendingLocation, setPendingLocation, useConfirmedDestination, updateDestination, destinationSuggestions, selectDestinationContact, selectExternalDestination, searchContext, selectedDestinationLocation, setSelectedDestinationLocation, insertBeforeId, setInsertBeforeId, priorityRoutes, saveContactOpen, setSaveContactOpen, contactSaveMessage, setContactSaveMessage, newContactName, setNewContactName, savingContact, saveDestinationAsContact, planningMapRoutes, setOpen, setPreviewOpen, setOriginSource, openBuilder, message, scheduledTodayRoutes = [], upcomingRoutes = [], completedTodayRoutes = [], issueTodayRoutes = [], renderRouteCards, loading, todayRoutes = [], inProgressRoutes = []} = w
  return <ManagerShell active="routes" branchName={defaultBranch?.name} roleLabel={t.managerRole}>
    <div className={styles.page}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{c.operations.toUpperCase()}</p>
        <h1>{c.title}</h1>
        <p>{c.subtitle}</p>
      </div>
      <div className={styles.headerActions}>
        <Link className={styles.secondaryButton} href="/routes/live"><MapPin size={18}/>{locale==='es'?'Mapa en vivo':locale==='fr'?'Carte en direct':'Live map'}</Link>
        <Link className={styles.secondaryButton} href="/contacts"><Users size={18}/>{t.contacts}</Link>
        <Link className={styles.secondaryButton} href="/routes/manage?reorder=1"><RouteIcon size={18}/>{c.manage}</Link>
        <button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button>
      </div>
    </header>
    {message && <div className={message.includes('successfully') || message.includes('publicad') ? styles.successMessage : styles.message} role="status">{message}</div>}
    <section className={styles.listHeading}>
      <div><h2>{c.assigned}</h2><p>{c.assignedHelp}</p></div>
      {!loading && <span>{todayRoutes.length} {c.active}</span>}
    </section>
    {loading ? <section className={styles.routeGrid} aria-label={c.loadError}>
      {[0, 1, 2].map(item => <div className={styles.skeletonCard} key={item}><i/><b/><span/></div>)}
    </section> : <>
      {inProgressRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.inProgressSection}</h2><span>{inProgressRoutes.length} {c.active}</span></div>
        <section className={styles.routeGrid}>{renderRouteCards(inProgressRoutes)}</section>
      </section>}
      <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.todaySection}</h2><span>{todayRoutes.length} {c.active}</span></div>
        {scheduledTodayRoutes.length ? <section className={styles.routeGrid}>{renderRouteCards(scheduledTodayRoutes)}</section> : <section className={styles.emptyState}><div><RouteIcon size={28}/></div><h2>{c.empty}</h2><p>{c.emptyHelp}</p><button className={styles.primaryButton} type="button" onClick={openBuilder}><Plus size={18}/>{c.add}</button></section>}
      </section>
      {upcomingRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.upcomingSection}</h2><span>{upcomingRoutes.length} {c.active}</span></div>
        <section className={styles.routeGrid}>{renderRouteCards(upcomingRoutes)}</section>
      </section>}
      {completedTodayRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.completedSection}</h2><span>{completedTodayRoutes.length} {c.active}</span></div>
        <section className={styles.routeGrid}>{renderRouteCards(completedTodayRoutes)}</section>
      </section>}
      {issueTodayRoutes.length > 0 && <section className={styles.routeSection}>
        <div className={styles.sectionHeading}><h2>{c.issue}</h2><span>{issueTodayRoutes.length}</span></div>
        <section className={styles.routeGrid}>{renderRouteCards(issueTodayRoutes)}</section>
      </section>}
    </>}
    </div>
    {open && <NewRouteDialog open={open} saving={saving} setOpen={setOpen} justCreated={justCreated} locale={locale} c={c} openBuilder={openBuilder} previewOpen={previewOpen} setPreviewOpen={setPreviewOpen} form={form} setForm={setForm} selectedContact={selectedContact} originMode={originMode} setOriginSource={setOriginSource} oc={oc} branches={branches} contacts={contacts} defaultBranch={defaultBranch} detailsOpen={detailsOpen} setDetailsOpen={setDetailsOpen} todayValue={todayValue} drivers={drivers} save={save} pendingLocation={pendingLocation} setPendingLocation={setPendingLocation} useConfirmedDestination={useConfirmedDestination} updateDestination={updateDestination} destinationSuggestions={destinationSuggestions} selectDestinationContact={selectDestinationContact} selectExternalDestination={selectExternalDestination} searchContext={searchContext} selectedDestinationLocation={selectedDestinationLocation} setSelectedDestinationLocation={setSelectedDestinationLocation} insertBeforeId={insertBeforeId} setInsertBeforeId={setInsertBeforeId} priorityRoutes={priorityRoutes} saveContactOpen={saveContactOpen} setSaveContactOpen={setSaveContactOpen} contactSaveMessage={contactSaveMessage} setContactSaveMessage={setContactSaveMessage} newContactName={newContactName} setNewContactName={setNewContactName} savingContact={savingContact} saveDestinationAsContact={saveDestinationAsContact} planningMapRoutes={planningMapRoutes} />}
    </ManagerShell>
}
