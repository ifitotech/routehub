'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import ManagerShell from '../../manager-shell'
import {getSupabase} from '../../../../lib/supabase'
import {uploadTruckReceipt} from '../../../../lib/truck-receipts'
import {useLocale} from '../../../../lib/use-preferences'
import styles from '../truck.module.css'

function recordsCopy(locale: string) {
  if (locale === 'es') return {
    operations: 'OPERACIONES', title: 'Registros del camión', subtitle: 'Registra combustible o mantenimiento del camión de la sucursal.', backToTruck: 'Volver a Camión',
    fuel: 'Combustible', maintenance: 'Mantenimiento', odometer: 'Odómetro', serviceType: 'Tipo de servicio', serviceTypePlaceholder: 'Cambio de aceite',
    amount: 'Monto', costOptional: 'Costo (opcional)', receiptOptional: 'Foto del recibo (opcional)', saving: 'Guardando…', saveRecord: 'Guardar registro',
    saved: 'Registro guardado correctamente.', unableSave: 'No se pudo guardar el registro.', unableCreate: 'No se pudo crear el registro.', selectedFile: 'Archivo seleccionado', activeTruck: 'Camión activo',
  }
  if (locale === 'fr') return {
    operations: 'OPÉRATIONS', title: 'Registres du camion', subtitle: 'Enregistrez le carburant ou l’entretien du camion de la succursale.', backToTruck: 'Retour au camion',
    fuel: 'Carburant', maintenance: 'Entretien', odometer: 'Kilométrage', serviceType: 'Type de service', serviceTypePlaceholder: 'Vidange',
    amount: 'Montant', costOptional: 'Coût (optionnel)', receiptOptional: 'Photo du reçu (optionnel)', saving: 'Enregistrement…', saveRecord: 'Enregistrer',
    saved: 'Enregistrement réussi.', unableSave: 'Impossible d’enregistrer.', unableCreate: 'Impossible de créer l’enregistrement.', selectedFile: 'Fichier sélectionné', activeTruck: 'Camion actif',
  }
  return {
    operations: 'OPERATIONS', title: 'Truck records', subtitle: 'Log fuel or maintenance for the active branch truck.', backToTruck: 'Back to truck',
    fuel: 'Fuel', maintenance: 'Maintenance', odometer: 'Odometer', serviceType: 'Service type', serviceTypePlaceholder: 'Oil change',
    amount: 'Amount', costOptional: 'Cost (optional)', receiptOptional: 'Receipt photo (optional)', saving: 'Saving…', saveRecord: 'Save record',
    saved: 'Record saved successfully.', unableSave: 'Unable to save record.', unableCreate: 'Could not create record.', selectedFile: 'Selected file', activeTruck: 'Active truck',
  }
}

type TruckRow = {
  id: string
  company_id: string
  branch_id: string
  name: string
}

type RecordKind = 'fuel' | 'maintenance'

export default function TruckRecordsPage() {
  const {locale} = useLocale()
  const c = recordsCopy(locale)
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
      if (!recordId) throw new Error(c.unableCreate)

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

      setMessage(c.saved)
      setOdometer('')
      setAmount('')
      setServiceType('')
      setReceipt(null)
      setReloadKey((value) => value + 1)
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : c.unableSave)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ManagerShell active="truck">
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{c.operations}</p>
            <h1>{c.title}</h1>
            <span>{c.subtitle}</span>
          </div>
          <Link href="/manager/truck" className={styles.primaryButton}>
            {c.backToTruck}
          </Link>
        </div>

        <div className={styles.recordForm}>
          <div className={styles.recordTabs}>
            <button type="button" onClick={() => setKind('fuel')} className={kind === 'fuel' ? styles.active : ''}>
              {c.fuel}
            </button>
            <button
              type="button"
              onClick={() => setKind('maintenance')}
              className={kind === 'maintenance' ? styles.active : ''}
            >
              {c.maintenance}
            </button>
          </div>

          <label>
            {c.odometer}
            <input type="number" min="0" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          </label>

          {kind === 'maintenance' ? (
            <label>
              {c.serviceType}
              <input
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder={c.serviceTypePlaceholder}
              />
            </label>
          ) : null}

          <label>
            {kind === 'fuel' ? c.amount : c.costOptional}
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>

          <label>
            {c.receiptOptional}
            <input type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} />
          </label>

          <button
            type="button"
            className={styles.primaryButton}
            disabled={busy || !odometer || (kind === 'fuel' && !amount) || (kind === 'maintenance' && !serviceType)}
            onClick={saveRecord}
          >
            {busy ? c.saving : c.saveRecord}
          </button>

          {message ? <p className={styles.recordMessage}>{message}</p> : null}
          {receipt ? <p className={styles.muted}>{c.selectedFile}: {receipt.name}</p> : null}
          {truck ? <p className={styles.muted}>{c.activeTruck}: {truck.name}</p> : null}
        </div>
      </div>
    </ManagerShell>
  )
}
