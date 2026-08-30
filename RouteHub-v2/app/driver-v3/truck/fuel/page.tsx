'use client'
import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {Camera} from 'lucide-react'
import DriverV3Shell from '../../../../components/driver-v3/DriverV3Shell'
import shellStyles from '../../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../../lib/use-preferences'
import {getSupabase} from '../../../../lib/supabase'
import {saveFuel} from '../../../../lib/driver-v3/actions'

export default function Fuel() {
  const router = useRouter()
  const {t} = useLocale()
  const {driverId, companyId, branchId} = useDriverData()
  const [truck, setTruck] = useState<any>(null)
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
    if (!truck || !odometer || !amount || busy) return
    setBusy(true)
    setMessage('')
    try {
      await saveFuel({
        truckId: truck.id,
        branchId: branchId || '',
        driverId,
        companyId,
        routeId: 'truck',
        odometer: Number(odometer),
        amount: Number(amount),
        photo: photo || undefined,
      })
      setMessageType('ok')
      setMessage('Fuel saved.')
      setOdometer('')
      setAmount('')
      setPhoto(null)
      router.replace('/driver/truck')
    } catch (e) {
      setMessageType('err')
      setMessage(e instanceof Error ? e.message : 'Unable to save fuel.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="truck" mode="stack" title={t.drvLogFuel} backHref="/driver/truck" backLabel={t.drvTruck}>
      

      <section className="card">
        {!truck ? (
          <p className="muted" style={{margin: 0}}>
            {t.drvNoTruck}
          </p>
        ) : (
          <>
            <p className="eyebrow">{t.drvCurrentTruck}</p>
            <h2 style={{margin: '4px 0 16px', fontSize: 18}}>
              {truck.name || truck.unit_number || 'Current truck'}
            </h2>

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
              Amount
              <input
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="e.g. 65.00"
                autoComplete="off"
              />
            </label>

            <label style={{marginBottom: 4}}>{t.drvReceipt}</label>
            <label
              className="secondary"
              style={{cursor: 'pointer', marginBottom: 16}}
            >
              <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                <Camera size={18} />
                {photo ? photo.name : t.drvAddReceipt}
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
                disabled={busy || !odometer || !amount}
                onClick={() => void submit()}
              >
                {busy ? 'Saving…' : t.drvSaveFuel}
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
