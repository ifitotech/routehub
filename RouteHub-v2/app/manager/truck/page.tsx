'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {Fuel, Plus, Settings2, Truck as TruckIcon} from 'lucide-react'
import ManagerShell from '../manager-shell'
import {getSupabase} from '../../../lib/supabase'
import {currentMembership} from '../../../lib/data'
import {signedTruckReceipt} from '../../../lib/truck-receipts'
import {useLocale} from '../../../lib/use-preferences'
import styles from './truck.module.css'

function truckCopy(locale: string) {
  if (locale === 'es') return {
    operations: 'OPERACIONES', title: 'Camión', subtitle: 'Agrega o edita el vehículo de la sucursal. El combustible y mantenimiento quedan ligados a este camión.',
    editTruck: 'Editar camión', addTruck: 'Añadir camión', addRecord: 'Añadir registro',
    unableLoad: 'No se pudo cargar el camión.', unableSave: 'No se pudo guardar el camión.', branchNotFound: 'No se encontró la sucursal.',
    name: 'Nombre', make: 'Marca', model: 'Modelo', year: 'Año', plate: 'Placa', odometerMi: 'Odómetro (millas)',
    saving: 'Guardando…', saveChanges: 'Guardar cambios', cancel: 'Cancelar', loading: 'Cargando información del camión…',
    noTruck: 'Sin camión asignado', noTruckHelp: 'Añade el camión de la sucursal para empezar a registrar combustible y mantenimiento.',
    activeTruck: 'CAMIÓN ACTIVO', branchVehicle: 'Vehículo de sucursal', odometer: 'Odómetro', miles: 'millas',
    fuel: 'COMBUSTIBLE', recentFuel: 'Combustible reciente', noFuel: 'Aún no hay registros de combustible.', receipt: 'Recibo',
    maintenance: 'MANTENIMIENTO', serviceHistory: 'Historial de servicio', noMaintenance: 'Aún no hay registros de mantenimiento.',
  }
  if (locale === 'fr') return {
    operations: 'OPÉRATIONS', title: 'Camion', subtitle: 'Ajoutez ou modifiez le véhicule de la succursale. Le carburant et l’entretien restent liés à ce camion.',
    editTruck: 'Modifier le camion', addTruck: 'Ajouter un camion', addRecord: 'Ajouter un enregistrement',
    unableLoad: 'Impossible de charger le camion.', unableSave: 'Impossible d’enregistrer le camion.', branchNotFound: 'Succursale introuvable.',
    name: 'Nom', make: 'Marque', model: 'Modèle', year: 'Année', plate: 'Plaque', odometerMi: 'Kilométrage (miles)',
    saving: 'Enregistrement…', saveChanges: 'Enregistrer', cancel: 'Annuler', loading: 'Chargement des informations du camion…',
    noTruck: 'Aucun camion assigné', noTruckHelp: 'Ajoutez le camion de la succursale pour commencer à suivre le carburant et l’entretien.',
    activeTruck: 'CAMION ACTIF', branchVehicle: 'Véhicule de succursale', odometer: 'Kilométrage', miles: 'miles',
    fuel: 'CARBURANT', recentFuel: 'Carburant récent', noFuel: 'Aucun enregistrement de carburant.', receipt: 'Reçu',
    maintenance: 'ENTRETIEN', serviceHistory: 'Historique d’entretien', noMaintenance: 'Aucun enregistrement d’entretien.',
  }
  return {
    operations: 'OPERATIONS', title: 'Truck', subtitle: 'Add or edit the branch vehicle. Fuel and maintenance stay on this truck.',
    editTruck: 'Edit truck', addTruck: 'Add truck', addRecord: 'Add record',
    unableLoad: 'Unable to load truck.', unableSave: 'Unable to save truck.', branchNotFound: 'Branch not found.',
    name: 'Name', make: 'Make', model: 'Model', year: 'Year', plate: 'Plate', odometerMi: 'Odometer (miles)',
    saving: 'Saving…', saveChanges: 'Save changes', cancel: 'Cancel', loading: 'Loading truck information…',
    noTruck: 'No truck assigned', noTruckHelp: 'Add the branch truck to start fuel and maintenance.',
    activeTruck: 'ACTIVE TRUCK', branchVehicle: 'Branch vehicle', odometer: 'Odometer', miles: 'miles',
    fuel: 'FUEL', recentFuel: 'Recent fuel', noFuel: 'No fuel records yet.', receipt: 'Receipt',
    maintenance: 'MAINTENANCE', serviceHistory: 'Service history', noMaintenance: 'No maintenance records yet.',
  }
}

type TruckRecord = {
  id: string
  name: string
  make: string | null
  model: string | null
  year: number | null
  plate_number: string | null
  current_odometer: number | null
}

type FuelLog = {
  id: string
  filled_at: string
  odometer: number
  amount: number
  receipt_path: string | null
}

type MaintenanceLog = {
  id: string
  serviced_at: string
  maintenance_type: string
  odometer: number | null
  amount: number | null
}

const emptyForm = {name: '', make: '', model: '', year: '', plate_number: '', current_odometer: ''}

export default function TruckPage() {
  const {locale} = useLocale()
  const c = truckCopy(locale)
  const [truck, setTruck] = useState<TruckRecord | null>(null)
  const [fuel, setFuel] = useState<FuelLog[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>([])
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [scope, setScope] = useState<{companyId: string; branchId: string} | null>(null)

  async function load() {
    const membership = await currentMembership()
    const client = getSupabase()
    let branchId = membership.branch_id || ''
    if (!branchId) {
      const {data: branch} = await client.from('branches').select('id').eq('company_id', membership.company_id).order('name').limit(1).maybeSingle()
      branchId = String(branch?.id || '')
    }
    if (!branchId) throw new Error(c.branchNotFound)
    setScope({companyId: membership.company_id, branchId})

    const {data: truckData, error: truckError} = await client
      .from('trucks')
      .select('id,name,make,model,year,plate_number,current_odometer')
      .eq('company_id', membership.company_id)
      .eq('branch_id', branchId)
      .eq('active', true)
      .order('updated_at', {ascending: false})
      .limit(1)
      .maybeSingle()
    if (truckError) throw truckError
    setTruck(truckData)

    if (!truckData) {
      setFuel([])
      setMaintenance([])
      setReceiptUrls({})
      return
    }

    const [fuelResult, maintenanceResult] = await Promise.all([
      client.from('truck_fuel_logs').select('id,filled_at,odometer,amount,receipt_path').eq('truck_id', truckData.id).order('filled_at', {ascending: false}).limit(8),
      client.from('truck_maintenance_logs').select('id,serviced_at,maintenance_type,odometer,amount').eq('truck_id', truckData.id).order('serviced_at', {ascending: false}).limit(8),
    ])
    setFuel(fuelResult.data || [])
    setMaintenance(maintenanceResult.data || [])
    const signedPairs = await Promise.all(
      (fuelResult.data || []).filter(row => row.receipt_path).map(async row => {
        const url = await signedTruckReceipt(row.receipt_path as string)
        return [row.id, url] as const
      }),
    )
    setReceiptUrls(Object.fromEntries(signedPairs))
  }

  useEffect(() => {
    void (async () => {
      try {
        await load()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : c.unableLoad)
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openForm(current?: TruckRecord | null) {
    setForm({
      name: current?.name || '',
      make: current?.make || '',
      model: current?.model || '',
      year: current?.year ? String(current.year) : '',
      plate_number: current?.plate_number || '',
      current_odometer: current?.current_odometer != null ? String(current.current_odometer) : '',
    })
    setEditing(true)
    setError('')
  }

  async function saveTruck() {
    if (!scope) return
    const name = form.name.trim() || 'Truck'
    setSaving(true)
    setError('')
    try {
      const client = getSupabase()
      const payload = {
        company_id: scope.companyId,
        branch_id: scope.branchId,
        name,
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? Number(form.year) : null,
        plate_number: form.plate_number.trim() || null,
        current_odometer: form.current_odometer ? Number(form.current_odometer) : null,
        active: true,
        updated_at: new Date().toISOString(),
      }
      if (truck?.id) {
        const {error: updateError} = await client.from('trucks').update(payload).eq('id', truck.id)
        if (updateError) throw updateError
      } else {
        const {error: insertError} = await client.from('trucks').insert(payload)
        if (insertError) throw insertError
      }
      setEditing(false)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : c.unableSave)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ManagerShell active="truck">
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{c.operations}</p>
            <h1>{c.title}</h1>
            <span>{c.subtitle}</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.primaryButton} type="button" onClick={() => openForm(truck)}>
              <Plus size={17} /> {truck ? c.editTruck : c.addTruck}
            </button>
            <Link href="/manager/truck/records" className={styles.secondaryButton}>{c.addRecord}</Link>
          </div>
        </header>

        {error ? <p className={styles.errorBanner}>{error}</p> : null}

        {editing ? (
          <form className={styles.recordForm} onSubmit={event => {event.preventDefault(); void saveTruck()}}>
            <label>{c.name}<input value={form.name} onChange={event => setForm(current => ({...current, name: event.target.value}))} placeholder="Truck 1" /></label>
            <div className={styles.formRow}>
              <label>{c.make}<input value={form.make} onChange={event => setForm(current => ({...current, make: event.target.value}))} placeholder="Ford" /></label>
              <label>{c.model}<input value={form.model} onChange={event => setForm(current => ({...current, model: event.target.value}))} placeholder="Transit" /></label>
            </div>
            <div className={styles.formRow}>
              <label>{c.year}<input inputMode="numeric" value={form.year} onChange={event => setForm(current => ({...current, year: event.target.value}))} placeholder="2022" /></label>
              <label>{c.plate}<input value={form.plate_number} onChange={event => setForm(current => ({...current, plate_number: event.target.value}))} placeholder="ABC-1234" /></label>
            </div>
            <label>{c.odometerMi}<input inputMode="decimal" value={form.current_odometer} onChange={event => setForm(current => ({...current, current_odometer: event.target.value}))} placeholder="48210" /></label>
            <div className={styles.headerActions}>
              <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? c.saving : truck ? c.saveChanges : c.addTruck}</button>
              <button className={styles.secondaryButton} type="button" onClick={() => setEditing(false)}>{c.cancel}</button>
            </div>
          </form>
        ) : loading ? (
          <div className={styles.empty}>{c.loading}</div>
        ) : !truck ? (
          <div className={styles.empty}>
            <TruckIcon size={28} />
            <strong>{c.noTruck}</strong>
            <span>{c.noTruckHelp}</span>
            <button className={styles.primaryButton} type="button" onClick={() => openForm(null)}><Plus size={17} /> {c.addTruck}</button>
          </div>
        ) : (
          <>
            <section className={styles.hero}>
              <div className={styles.heroIcon}>
                <TruckIcon size={30} />
              </div>
              <div>
                <p>{c.activeTruck}</p>
                <h2>{truck.name}</h2>
                <span>
                  {[truck.year, truck.make, truck.model].filter(Boolean).join(' ') || c.branchVehicle}
                  {truck.plate_number ? ` · ${truck.plate_number}` : ''}
                </span>
              </div>
              <div className={styles.odometer}>
                <small>{c.odometer}</small>
                <strong>{truck.current_odometer ?? '—'}</strong>
                <span>{c.miles}</span>
              </div>
            </section>

            <div className={styles.grid}>
              <section className={styles.panel}>
                <header>
                  <div>
                    <p>{c.fuel}</p>
                    <h2>{c.recentFuel}</h2>
                  </div>
                  <Fuel size={20} />
                </header>
                {fuel.length ? fuel.map(log => (
                  <div className={styles.row} key={log.id}>
                    <span>{new Date(log.filled_at).toLocaleDateString(locale)}</span>
                    <strong>${Number(log.amount).toFixed(2)}</strong>
                    <small>
                      {log.odometer} mi
                      {log.receipt_path ? <Link href={receiptUrls[log.id] ?? '#'} className={styles.receiptLink}>{c.receipt}</Link> : null}
                    </small>
                  </div>
                )) : <p className={styles.muted}>{c.noFuel}</p>}
              </section>
              <section className={styles.panel}>
                <header>
                  <div>
                    <p>{c.maintenance}</p>
                    <h2>{c.serviceHistory}</h2>
                  </div>
                  <Settings2 size={20} />
                </header>
                {maintenance.length ? maintenance.map(log => (
                  <div className={styles.row} key={log.id}>
                    <span>{new Date(log.serviced_at).toLocaleDateString(locale)}</span>
                    <strong>{log.maintenance_type}</strong>
                    <small>{log.odometer ? `${log.odometer} mi` : ''}</small>
                  </div>
                )) : <p className={styles.muted}>{c.noMaintenance}</p>}
              </section>
            </div>
          </>
        )}
      </div>
    </ManagerShell>
  )
}
