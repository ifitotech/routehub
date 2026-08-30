'use client'
import {useEffect, useState} from 'react'
import Link from 'next/link'
import {Camera} from 'lucide-react'
import DriverV3Shell from '../../../../components/driver-v3/DriverV3Shell'
import shellStyles from '../../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../../lib/driver-v3/use-driver-data'
import {getSupabase} from '../../../../lib/supabase'
import {saveMaintenance} from '../../../../lib/driver-v3/actions'

const TYPES = ['Oil change', 'Tires', 'Brakes', 'Inspection', 'Other'] as const

export default function Maintenance() {
  const {driverId, companyId, branchId} = useDriverData()
  const [truck, setTruck] = useState<any>(null)
  const [type, setType] = useState('')
  const [odometer, setOdometer] = useState('')
  const [amount, setAmount] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')

  useEffect(() => {
    if (!companyId || !branchId) return
    void getSupabase()
      .from('trucks')
      .select('id,name,unit_number')
      .eq('company_id', companyId)
      .eq('branch_id', branchId)
      .eq('active', true)
      .limit(1)
      .then(r => setTruck(r.data?.[0] || null))
  }, [companyId, branchId])

  const submit = async () => {
    if (!truck || !type.trim() || busy) return
    setBusy(true)
    setMessage('')
    try {
      await saveMaintenance({
        truckId: truck.id,
        branchId: branchId || '',
        driverId,
        companyId,
        routeId: 'truck',
        maintenanceType: type.trim(),
        odometer: Number(odometer || 0),
        amount: amount ? Number(amount) : undefined,
        photo: photo || undefined,
      })
      setMessageType('ok')
      setMessage('Maintenance saved.')
      setType('')
      setOdometer('')
      setAmount('')
      setPhoto(null)
    } catch (e) {
      setMessageType('err')
      setMessage(e instanceof Error ? e.message : 'Unable to save maintenance.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="truck">
      <Link href="/driver/truck" className="muted">
        ‹ Truck
      </Link>
      <p className="eyebrow">TRUCK</p>
      <h1 className="title">Log Maintenance</h1>

      <section className="card">
        {!truck ? (
          <p className="muted" style={{margin: 0}}>
            No truck assigned or available for this branch.
          </p>
        ) : (
          <>
            <p className="eyebrow">VEHICLE</p>
            <h2 style={{margin: '4px 0 16px', fontSize: 18}}>
              {truck.name || truck.unit_number || 'Current truck'}
            </h2>

            <p className="eyebrow">MAINTENANCE TYPE</p>
            <div style={{display: 'grid', gap: 8, margin: '8px 0 14px'}}>
              {TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  className="secondary"
                  onClick={() => setType(t)}
                  style={{
                    justifyContent: 'flex-start',
                    paddingLeft: 14,
                    borderColor: type === t ? '#1667F2' : undefined,
                    background: type === t ? '#EAF2FF' : undefined,
                    color: type === t ? '#1667F2' : undefined,
                    fontWeight: type === t ? 800 : 600,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <label>
              Mileage
              <input
                inputMode="numeric"
                value={odometer}
                onChange={e => setOdometer(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="e.g. 45210"
                autoComplete="off"
              />
            </label>

            <label>
              Cost (optional)
              <input
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="e.g. 89.00"
                autoComplete="off"
              />
            </label>

            <label style={{marginBottom: 4}}>Receipt / photo (optional)</label>
            <label className="secondary" style={{cursor: 'pointer', marginBottom: 16}}>
              <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                <Camera size={18} />
                {photo ? photo.name : 'Add receipt photo'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={e => setPhoto(e.target.files?.[0] || null)}
              />
            </label>

            <div className={shellStyles.stickyAction}>
              <button
                className="primary"
                disabled={busy || !type.trim()}
                onClick={() => void submit()}
              >
                {busy ? 'Saving…' : 'SAVE MAINTENANCE'}
              </button>
            </div>

            {message && (
              <p
                role="status"
                className="muted"
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: messageType === 'ok' ? '#EAF9F1' : '#FFF0F0',
                  color: messageType === 'ok' ? '#147a4a' : '#b42318',
                  fontWeight: 600,
                }}
              >
                {message}
              </p>
            )}
          </>
        )}
      </section>
    </DriverV3Shell>
  )
}
