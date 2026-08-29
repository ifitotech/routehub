'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import ManagerShell from '../../manager-shell'
import {getSupabase} from '../../../../lib/supabase'
import {uploadTruckReceipt} from '../../../../lib/truck-receipts'

type TruckRow = {
  id: string
  company_id: string
  branch_id: string
  name: string
}

type RecordKind = 'fuel' | 'maintenance'

export default function TruckRecordsPage() {
  const [truck, setTruck] = useState<TruckRow | null>(null)
  const [kind, setKind] = useState<RecordKind>('fuel')
  const [odometer, setOdometer] = useState('')
  const [amount, setAmount] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    void (async () => {
      const client = getSupabase()
      const {data: userResult} = await client.auth.getUser()
      const user = userResult.user
      if (!user) return

      const {data: member} = await client
        .from('company_users')
        .select('company_id, branch_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!member) return

      const {data: truckRow} = await client
        .from('trucks')
        .select('id, company_id, branch_id, name')
        .eq('company_id', member.company_id)
        .eq('branch_id', member.branch_id)
        .eq('active', true)
        .limit(1)
        .maybeSingle()

      setTruck(truckRow)
    })()
  }, [reloadKey])

  async function saveRecord() {
    if (!truck) return

    setBusy(true)
    setMessage('')

    try {
      const client = getSupabase()
      const {data: userResult} = await client.auth.getUser()
      const user = userResult.user
      if (!user) throw new Error('Sign in required.')

      const baseRecord = {
        truck_id: truck.id,
        company_id: truck.company_id,
        branch_id: truck.branch_id,
        recorded_by: user.id,
        odometer: Number(odometer),
      }

      const insertResult =
        kind === 'fuel'
          ? await client
              .from('truck_fuel_logs')
              .insert({...baseRecord, amount: Number(amount)})
              .select('id')
              .single()
          : await client
              .from('truck_maintenance_logs')
              .insert({
                ...baseRecord,
                maintenance_type: serviceType,
                amount: amount ? Number(amount) : null,
              })
              .select('id')
              .single()

      if (insertResult.error) throw insertResult.error

      const recordId = insertResult.data?.id
      if (!recordId) throw new Error('Could not create record.')

      if (receipt) {
        try {
          const receiptPath = await uploadTruckReceipt(receipt, {
            companyId: truck.company_id,
            branchId: truck.branch_id,
            truckId: truck.id,
            recordId,
          })

          const table = kind === 'fuel' ? 'truck_fuel_logs' : 'truck_maintenance_logs'
          const updateResult = await client.from(table).update({receipt_path: receiptPath}).eq('id', recordId)
          if (updateResult.error) throw updateResult.error
        } catch (uploadError) {
          await client.from(kind === 'fuel' ? 'truck_fuel_logs' : 'truck_maintenance_logs').delete().eq('id', recordId)
          throw uploadError
        }
      }

      setMessage('Record saved successfully.')
      setOdometer('')
      setAmount('')
      setServiceType('')
      setReceipt(null)
      setReloadKey((value) => value + 1)
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : 'Unable to save record.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ManagerShell active="truck">
      <div className="truckPage">
        <div className="truckHeader">
          <div>
            <p className="truckEyebrow">OPERATIONS</p>
            <h1>Truck records</h1>
            <span>Log fuel or maintenance for the active branch truck.</span>
          </div>
          <Link href="/manager/truck" className="truckPrimary">
            Back to truck
          </Link>
        </div>

        <div className="truckRecordForm">
          <div className="truckRecordTabs">
            <button type="button" onClick={() => setKind('fuel')} className={kind === 'fuel' ? 'active' : ''}>
              Fuel
            </button>
            <button
              type="button"
              onClick={() => setKind('maintenance')}
              className={kind === 'maintenance' ? 'active' : ''}
            >
              Maintenance
            </button>
          </div>

          <label>
            Odometer
            <input type="number" min="0" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          </label>

          {kind === 'maintenance' ? (
            <label>
              Service type
              <input
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="Oil change"
              />
            </label>
          ) : null}

          <label>
            {kind === 'fuel' ? 'Amount' : 'Cost (optional)'}
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>

          <label>
            Receipt photo (optional)
            <input type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} />
          </label>

          <button
            type="button"
            className="truckPrimary"
            disabled={busy || !odometer || (kind === 'fuel' && !amount) || (kind === 'maintenance' && !serviceType)}
            onClick={saveRecord}
          >
            {busy ? 'Saving…' : 'Save record'}
          </button>

          {message ? <p className="truckRecordMessage">{message}</p> : null}
          {receipt ? <p className="truckMuted">Selected file: {receipt.name}</p> : null}
          {truck ? <p className="truckMuted">Active truck: {truck.name}</p> : null}
        </div>
      </div>
    </ManagerShell>
  )
}
