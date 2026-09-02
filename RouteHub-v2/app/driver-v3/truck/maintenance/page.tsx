'use client'
import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {Camera} from 'lucide-react'
import DriverV3Shell from '../../../../components/driver-v3/DriverV3Shell'
import shellStyles from '../../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../../lib/use-preferences'
import {getSupabase} from '../../../../lib/supabase'
import {saveMaintenance} from '../../../../lib/driver-v3/actions'

const TYPES = [
  {id: 'Oil change', key: 'drvOil'},
  {id: 'Tires', key: 'drvTires'},
  {id: 'Brakes', key: 'drvBrakes'},
  {id: 'Inspection', key: 'drvInspect'},
  {id: 'Other', key: 'drvIssueOther'},
] as const

export default function Maintenance() {
  const router = useRouter()
  const {t} = useLocale()
  const {driverId, companyId, branchId} = useDriverData()
  const [truck, setTruck] = useState<any>(null)
  const [type, setType] = useState('')
  const [odometer, setOdometer] = useState('')
  const [amount, setAmount] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')

  const loadTruck = async () => {
    let query = getSupabase()
      .from('trucks')
      .select('id,name,unit_number,branch_id')
      .eq('company_id', companyId)
      .eq('active', true)
      .limit(1)
    if (branchId) query = query.eq('branch_id', branchId)
    const primary = await query
    if (!primary.error) return primary
    if (!/unit_number|schema cache|column/i.test(primary.error.message || '')) return primary
    let fallback = getSupabase()
      .from('trucks')
      .select('id,name,branch_id')
      .eq('company_id', companyId)
      .eq('active', true)
      .limit(1)
    if (branchId) fallback = fallback.eq('branch_id', branchId)
    const result = await fallback
    return {
      ...result,
      data: (result.data || []).map(item => ({...item, unit_number: null})),
    }
  }

  useEffect(() => {
    if (!companyId) return
    void loadTruck().then(r => setTruck(r.data?.[0] || null))
  }, [companyId, branchId])

  const submit = async () => {
    if (!truck || !type.trim() || busy) return
    if (!odometer.trim() || Number(odometer) <= 0) {
      setMessageType('err')
      setMessage(t.drvNeedNote)
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await saveMaintenance({
        truckId: truck.id,
        branchId: truck.branch_id,
        driverId,
        companyId,
        routeId: 'truck',
        maintenanceType: type.trim(),
        odometer: Number(odometer || 0),
        amount: amount ? Number(amount) : undefined,
        photo: photo || undefined,
      })
      setMessageType('ok')
      setMessage(t.drvMaintSaved)
      setType('')
      setOdometer('')
      setAmount('')
      setPhoto(null)
      window.setTimeout(() => router.replace('/driver/truck?saved=maint'), 900)
    } catch (e) {
      setMessageType('err')
      setMessage(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="truck" mode="stack" title={t.drvLogMaintenance} backHref="/driver/truck" backLabel={t.drvTruck}>
      

      <section className="card">
        {!truck ? (
          <p className="muted" style={{margin: 0}}>
            {t.drvNoTruck}
          </p>
        ) : (
          <>
            <p className="eyebrow">{t.drvCurrentTruck}</p>
            <h2 style={{margin: '4px 0 16px', fontSize: 18}}>
              {truck.name || truck.unit_number || t.drvCurrentTruckName}
            </h2>

            <p className="eyebrow">{t.drvLogMaintenance}</p>
            <div style={{display: 'grid', gap: 8, margin: '8px 0 14px'}}>
              {TYPES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="secondary"
                  onClick={() => setType(item.id)}
                  style={{
                    justifyContent: 'flex-start',
                    paddingLeft: 14,
                    borderColor: type === item.id ? '#1667F2' : undefined,
                    background: type === item.id ? '#EAF2FF' : undefined,
                    color: type === item.id ? '#1667F2' : undefined,
                    fontWeight: type === item.id ? 800 : 600,
                  }}
                >
                  {t[item.key]}
                </button>
              ))}
            </div>

            <label>
              {t.drvMileage}
              <input
                inputMode="numeric"
                value={odometer}
                onChange={e => setOdometer(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="e.g. 45210"
                autoComplete="off"
              />
            </label>

            <label>
              {t.drvAmount}
              <input
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="e.g. 89.00"
                autoComplete="off"
              />
            </label>

            <label style={{marginBottom: 4}}>{t.drvReceipt}</label>
            <label className="secondary" style={{cursor: 'pointer', marginBottom: 16}}>
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
                disabled={busy || !type.trim()}
                onClick={() => void submit()}
              >
                {busy ? 'Saving…' : t.drvSaveMaint}
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
