'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {Fuel, Plus, Settings2, Truck as TruckIcon} from 'lucide-react'
import ManagerShell from '../manager-shell'
import {getSupabase} from '../../../lib/supabase'
import {currentMembership} from '../../../lib/data'
import {signedTruckReceipt} from '../../../lib/truck-receipts'
import './truck.css'

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
    if (!branchId) throw new Error('Branch not found.')
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
        setError(cause instanceof Error ? cause.message : 'Unable to load truck.')
      } finally {
        setLoading(false)
      }
    })()
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
      setError(cause instanceof Error ? cause.message : 'Unable to save truck.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ManagerShell active="truck">
      <div className="truckPage">
        <header className="truckHeader">
          <div>
            <p className="truckEyebrow">OPERATIONS</p>
            <h1>Truck</h1>
            <span>Add or edit the branch vehicle. Fuel and maintenance stay on this truck.</span>
          </div>
          <div className="truckHeaderActions">
            <button className="truckPrimary" type="button" onClick={() => openForm(truck)}>
              <Plus size={17} /> {truck ? 'Edit truck' : 'Add truck'}
            </button>
            <Link href="/manager/truck/records" className="truckSecondary">Add record</Link>
          </div>
        </header>

        {error ? <p className="truckError">{error}</p> : null}

        {editing ? (
          <form className="truckRecordForm" onSubmit={event => {event.preventDefault(); void saveTruck()}}>
            <label>Name<input value={form.name} onChange={event => setForm(current => ({...current, name: event.target.value}))} placeholder="Truck 1" /></label>
            <div className="truckFormRow">
              <label>Make<input value={form.make} onChange={event => setForm(current => ({...current, make: event.target.value}))} placeholder="Ford" /></label>
              <label>Model<input value={form.model} onChange={event => setForm(current => ({...current, model: event.target.value}))} placeholder="Transit" /></label>
            </div>
            <div className="truckFormRow">
              <label>Year<input inputMode="numeric" value={form.year} onChange={event => setForm(current => ({...current, year: event.target.value}))} placeholder="2022" /></label>
              <label>Plate<input value={form.plate_number} onChange={event => setForm(current => ({...current, plate_number: event.target.value}))} placeholder="ABC-1234" /></label>
            </div>
            <label>Odometer (miles)<input inputMode="decimal" value={form.current_odometer} onChange={event => setForm(current => ({...current, current_odometer: event.target.value}))} placeholder="48210" /></label>
            <div className="truckHeaderActions">
              <button className="truckPrimary" type="submit" disabled={saving}>{saving ? 'Saving…' : truck ? 'Save changes' : 'Add truck'}</button>
              <button className="truckSecondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : loading ? (
          <div className="truckEmpty">Loading truck information…</div>
        ) : !truck ? (
          <div className="truckEmpty">
            <TruckIcon size={28} />
            <strong>No truck assigned</strong>
            <span>Add the branch truck to start fuel and maintenance.</span>
            <button className="truckPrimary" type="button" onClick={() => openForm(null)}><Plus size={17} /> Add truck</button>
          </div>
        ) : (
          <>
            <section className="truckHero">
              <div className="truckHeroIcon">
                <TruckIcon size={30} />
              </div>
              <div>
                <p>ACTIVE TRUCK</p>
                <h2>{truck.name}</h2>
                <span>
                  {[truck.year, truck.make, truck.model].filter(Boolean).join(' ') || 'Branch vehicle'}
                  {truck.plate_number ? ` · ${truck.plate_number}` : ''}
                </span>
              </div>
              <div className="truckOdometer">
                <small>Odometer</small>
                <strong>{truck.current_odometer ?? '—'}</strong>
                <span>miles</span>
              </div>
            </section>

            <div className="truckGrid">
              <section className="truckPanel">
                <header>
                  <div>
                    <p>FUEL</p>
                    <h2>Recent fuel</h2>
                  </div>
                  <Fuel size={20} />
                </header>
                {fuel.length ? fuel.map(log => (
                  <div className="truckRow" key={log.id}>
                    <span>{new Date(log.filled_at).toLocaleDateString()}</span>
                    <strong>${Number(log.amount).toFixed(2)}</strong>
                    <small>
                      {log.odometer} mi
                      {log.receipt_path ? <Link href={receiptUrls[log.id] ?? '#'} className="truckReceiptLink">Receipt</Link> : null}
                    </small>
                  </div>
                )) : <p className="truckMuted">No fuel records yet.</p>}
              </section>
              <section className="truckPanel">
                <header>
                  <div>
                    <p>MAINTENANCE</p>
                    <h2>Service history</h2>
                  </div>
                  <Settings2 size={20} />
                </header>
                {maintenance.length ? maintenance.map(log => (
                  <div className="truckRow" key={log.id}>
                    <span>{new Date(log.serviced_at).toLocaleDateString()}</span>
                    <strong>{log.maintenance_type}</strong>
                    <small>{log.odometer ? `${log.odometer} mi` : ''}</small>
                  </div>
                )) : <p className="truckMuted">No maintenance records yet.</p>}
              </section>
            </div>
          </>
        )}
      </div>
    </ManagerShell>
  )
}
