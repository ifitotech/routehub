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
  const [truck, setTruck] = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let gone = false
    const load = async () => {
      if (!companyId || !branchId) {
        setLoading(false)
        return
      }
      const db = getSupabase()
      const [t, f, m] = await Promise.all([
        db
          .from('trucks')
          .select('id,name,unit_number')
          .eq('company_id', companyId)
          .eq('branch_id', branchId)
          .eq('active', true)
          .limit(1),
        db
          .from('truck_fuel_logs')
          .select('id,odometer,amount,filled_at')
          .eq('company_id', companyId)
          .eq('branch_id', branchId)
          .order('filled_at', {ascending: false})
          .limit(8),
        db
          .from('truck_maintenance_logs')
          .select('id,maintenance_type,odometer,amount,serviced_at')
          .eq('company_id', companyId)
          .eq('branch_id', branchId)
          .order('serviced_at', {ascending: false})
          .limit(8),
      ])
      if (gone) return
      if (t.error || f.error || m.error) {
        setError('Unable to load truck activity.')
      } else {
        setTruck(t.data?.[0] || null)
        setActivity(
          [
            ...((f.data || []).map((x: any) => ({
              ...x,
              kind: 'Fuel',
              label: 'Fuel',
              at: x.filled_at,
            }))),
            ...((m.data || []).map((x: any) => ({
              ...x,
              kind: 'Maintenance',
              label: x.maintenance_type || 'Maintenance',
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
  }, [companyId, branchId])

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
              <h2 style={{margin: '4px 0 0'}}>{truck.name || truck.unit_number}</h2>
            ) : (
              <>
                <h2 style={{margin: '4px 0 6px'}}>{t.drvNoTruck}</h2>
                <p className="muted" style={{margin: 0}}>
                  When a vehicle is assigned to your branch, it will appear here.
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
                No fuel or maintenance logs yet.
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
