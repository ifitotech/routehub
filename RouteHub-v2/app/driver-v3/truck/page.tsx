'use client'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {Fuel, Wrench} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'
import {getSupabase} from '../../../lib/supabase'

export default function DriverV3Truck() {
  const {companyId, branchId} = useDriverData()
  const {t} = useLocale()
  const [trucks, setTrucks] = useState<any[]>([])
  const [truckId, setTruckId] = useState('')
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const truck = trucks.find(item => item.id === truckId) || trucks[0] || null

  const loadTrucks = async () => {
    const db = getSupabase()
    let truckQuery = db
      .from('trucks')
      .select('id,name,unit_number,branch_id')
      .eq('company_id', companyId)
      .eq('active', true)
    if (branchId) truckQuery = truckQuery.eq('branch_id', branchId)
    const primary = await truckQuery
    if (!primary.error) return primary
    if (!/unit_number|schema cache|column/i.test(primary.error.message || '')) return primary
    let fallbackQuery = db
      .from('trucks')
      .select('id,name,branch_id')
      .eq('company_id', companyId)
      .eq('active', true)
    if (branchId) fallbackQuery = fallbackQuery.eq('branch_id', branchId)
    const fallback = await fallbackQuery
    return {
      ...fallback,
      data: (fallback.data || []).map(item => ({...item, unit_number: null})),
    }
  }

  useEffect(() => {
    let gone = false
    const load = async () => {
      if (!companyId) {
        setLoading(false)
        return
      }
      const db = getSupabase()
      const truckResult = await loadTrucks()
      if (gone) return
      if (truckResult.error) {
        setError(t.drvOpFailed)
        setLoading(false)
        return
      }
      const list = truckResult.data || []
      setTrucks(list)
      const selected = truckId && list.some(item => item.id === truckId) ? truckId : list[0]?.id || ''
      if (selected !== truckId) setTruckId(selected)
      if (!selected) {
        setActivity([])
        setLoading(false)
        return
      }
      const [fuelResult, maintenanceResult] = await Promise.all([
        db
          .from('truck_fuel_logs')
          .select('id,odometer,amount,filled_at,truck_id')
          .eq('company_id', companyId)
          .eq('truck_id', selected)
          .order('filled_at', {ascending: false})
          .limit(8),
        db
          .from('truck_maintenance_logs')
          .select('id,maintenance_type,odometer,amount,serviced_at,truck_id')
          .eq('company_id', companyId)
          .eq('truck_id', selected)
          .order('serviced_at', {ascending: false})
          .limit(8),
      ])
      if (gone) return
      if (fuelResult.error || maintenanceResult.error) {
        setError(t.drvOpFailed)
      } else {
        setActivity(
          [
            ...((fuelResult.data || []).map((x: any) => ({
              ...x,
              kind: 'Fuel',
              label: t.drvLogFuel,
              at: x.filled_at,
            }))),
            ...((maintenanceResult.data || []).map((x: any) => ({
              ...x,
              kind: 'Maintenance',
              label: x.maintenance_type || t.drvLogMaintenance,
              at: x.serviced_at,
            }))),
          ]
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
            .slice(0, 6)
        )
      }
      setLoading(false)
    }
    void load()
    return () => {
      gone = true
    }
  }, [companyId, branchId, truckId, t.drvOpFailed, t.drvLogFuel, t.drvLogMaintenance])

  return (
    <DriverV3Shell active="truck" title={t.drvTruck}>

      {loading ? (
        <section className="card"><p className="muted" style={{margin: 0}}>{t.drvLoadingTruck}</p></section>
      ) : error ? (
        <section className="card">
          <h2>{t.drvNoTruck}</h2>
          <p className="muted">{error}</p>
        </section>
      ) : (
        <>
          <section className="card">
            <p className="eyebrow">{t.drvCurrentTruck}</p>
            {truck ? (
              <>
                <h2 style={{margin: '4px 0 0'}}>{truck.name || truck.unit_number}</h2>
                {trucks.length > 1 && (
                  <select value={truckId} onChange={e => setTruckId(e.target.value)} style={{marginTop: 10, minHeight: 48}}>
                    {trucks.map(item => (
                      <option key={item.id} value={item.id}>{item.name || item.unit_number}</option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <>
                <h2 style={{margin: '4px 0 6px'}}>{t.drvNoTruck}</h2>
                <p className="muted" style={{margin: 0}}>
                  {t.drvVehicleHelp}
                </p>
              </>
            )}
          </section>

          <section className="card">
            <p className="eyebrow">{t.drvQuickActions}</p>
            <div style={{display: 'grid', gap: 10, marginTop: 8}}>
              <Link
                className="primary"
                href="/driver/truck/fuel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  textDecoration: 'none',
                  opacity: truck ? 1 : 0.55,
                  pointerEvents: truck ? 'auto' : 'none',
                }}
              >
                <Fuel size={18} />
                {t.drvLogFuel}
              </Link>
              <Link
                className="secondary"
                href="/driver/truck/maintenance"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  textDecoration: 'none',
                  opacity: truck ? 1 : 0.55,
                  pointerEvents: truck ? 'auto' : 'none',
                }}
              >
                <Wrench size={18} />
                {t.drvLogMaintenance}
              </Link>
            </div>
          </section>

          <section className="card">
            <p className="eyebrow">{t.drvRecentActivity}</p>
            {activity.length === 0 ? (
              <p className="muted" style={{margin: '8px 0 0'}}>
                {t.drvNoLogs}
              </p>
            ) : (
              <div style={{marginTop: 4}}>
                {activity.map((item: any) => (
                  <div className="row" key={`${item.kind}-${item.id}`}>
                    <div>
                      <strong style={{fontSize: 15}}>{item.label}</strong>
                      <p className="muted" style={{margin: 0, fontSize: 13}}>
                        {item.odometer != null ? `${item.odometer} mi` : ''}
                        {item.amount != null ? ` · $${Number(item.amount).toFixed(2)}` : ''}
                        {item.at ? ` · ${new Date(item.at).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </DriverV3Shell>
  )
}
