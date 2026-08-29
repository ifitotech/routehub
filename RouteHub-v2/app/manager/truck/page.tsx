'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {Fuel, Plus, Settings2, Truck as TruckIcon} from 'lucide-react'
import ManagerShell from '../manager-shell'
import {getSupabase} from '../../../lib/supabase'
import {signedTruckReceipt} from '../../../lib/truck-receipts'

type TruckRecord = {
  id: string
  name: string
  make: string | null
  model: string | null
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

export default function TruckPage() {
  const [truck, setTruck] = useState<TruckRecord | null>(null)
  const [fuel, setFuel] = useState<FuelLog[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>([])
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const client = getSupabase()
        const {data: userResult} = await client.auth.getUser()
        const user = userResult.user
        if (!user) throw new Error('Sign in required.')

        const {data: member} = await client
          .from('company_users')
          .select('company_id,branch_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        if (!member) throw new Error('Workspace not found.')

        const {data: truckData} = await client
          .from('trucks')
          .select('id,name,make,model,plate_number,current_odometer')
          .eq('company_id', member.company_id)
          .eq('branch_id', member.branch_id)
          .eq('active', true)
          .limit(1)
          .maybeSingle()

        setTruck(truckData)

        if (!truckData) {
          setFuel([])
          setMaintenance([])
          setReceiptUrls({})
          return
        }

        const [fuelResult, maintenanceResult] = await Promise.all([
          client
            .from('truck_fuel_logs')
            .select('id,filled_at,odometer,amount,receipt_path')
            .eq('truck_id', truckData.id)
            .order('filled_at', {ascending: false})
            .limit(8),
          client
            .from('truck_maintenance_logs')
            .select('id,serviced_at,maintenance_type,odometer,amount')
            .eq('truck_id', truckData.id)
            .order('serviced_at', {ascending: false})
            .limit(8),
        ])

        setFuel(fuelResult.data || [])
        setMaintenance(maintenanceResult.data || [])

        const signedPairs = await Promise.all(
          (fuelResult.data || [])
            .filter((row) => row.receipt_path)
            .map(async (row) => {
              const url = await signedTruckReceipt(row.receipt_path as string)
              return [row.id, url] as const
            }),
        )
        setReceiptUrls(Object.fromEntries(signedPairs))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load truck.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <ManagerShell active="truck">
      <div className="truckPage">
        <header className="truckHeader">
          <div>
            <p className="truckEyebrow">OPERATIONS</p>
            <h1>Truck</h1>
            <span>Fuel and maintenance for the branch vehicle.</span>
          </div>
          <Link href="/manager/truck/records" className="truckPrimary">
            <Plus size={17} /> Add record
          </Link>
        </header>

        {error ? <p className="truckError">{error}</p> : null}

        {loading ? (
          <div className="truckEmpty">Loading truck information…</div>
        ) : !truck ? (
          <div className="truckEmpty">
            <TruckIcon size={28} />
            <strong>No truck assigned</strong>
            <span>Assign a truck to this branch to start tracking operations.</span>
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
                  {[truck.make, truck.model].filter(Boolean).join(' ') || 'Branch vehicle'}
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

                {fuel.length ? (
                  fuel.map((log) => (
                    <div className="truckRow" key={log.id}>
                      <span>{new Date(log.filled_at).toLocaleDateString()}</span>
                      <strong>${Number(log.amount).toFixed(2)}</strong>
                      <small>
                        {log.odometer} mi
                        {log.receipt_path ? (
                          <Link href={receiptUrls[log.id] ?? '#'} className="truckReceiptLink">
                            Receipt
                          </Link>
                        ) : null}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="truckMuted">No fuel records yet.</p>
                )}
              </section>

              <section className="truckPanel">
                <header>
                  <div>
                    <p>MAINTENANCE</p>
                    <h2>Service history</h2>
                  </div>
                  <Settings2 size={20} />
                </header>

                {maintenance.length ? (
                  maintenance.map((log) => (
                    <div className="truckRow" key={log.id}>
                      <span>{new Date(log.serviced_at).toLocaleDateString()}</span>
                      <strong>{log.maintenance_type}</strong>
                      <small>{log.odometer ? `${log.odometer} mi` : ''}</small>
                    </div>
                  ))
                ) : (
                  <p className="truckMuted">No maintenance records yet.</p>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </ManagerShell>
  )
}
