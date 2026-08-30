'use client'
import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {useRouter, useSearchParams} from 'next/navigation'
import {
  AlertTriangle,
  Camera,
  FileText,
  MapPin,
  Navigation,
  PenLine,
  Phone,
  X,
} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import styles from '../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {
  markArrived,
  completeStop,
  completeDeliveryWithRecipient,
  completePickupWithEvidence,
  updateRouteStatus,
  saveStopNote,
  uploadStopPhoto,
  saveStopSignature,
  reportIssue,
} from '../../../lib/driver-v3/actions'
import {openNavigation} from '../../../lib/maps/external-navigation'
import {getCurrentLocation} from '../../../lib/location'
import {getSupabase} from '../../../lib/supabase'
import {operationalDate} from '../../../lib/driver-queue'
import {useLocale} from '../../../lib/use-preferences'

const operationLabel = (kind: string) =>
  kind === 'branch' ? 'RETURN' : kind === 'pickup' ? 'PICKUP' : 'DELIVERY'

const ISSUE_CATEGORIES = [
  {id: 'Customer unavailable', labelKey: 'drvIssueCust'},
  {id: 'Wrong address', labelKey: 'drvIssueAddr'},
  {id: 'Damaged item', labelKey: 'drvIssueDmg'},
  {id: 'Access problem', labelKey: 'drvIssueAccess'},
  {id: 'Other', labelKey: 'drvIssueOther'},
] as const

type Sheet = 'photo' | 'signature' | 'notes' | 'issue' | null

export default function DriverV3Stop() {
  const {t} = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const {driverId, loading, error, routes, snapshot, refresh} = useDriverData()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [sheetBusy, setSheetBusy] = useState(false)
  const [sheetMsg, setSheetMsg] = useState('')
  const [note, setNote] = useState('')
  const [issueCat, setIssueCat] = useState('')
  const [issueNote, setIssueNote] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [recipient, setRecipient] = useState('')
  const [packingFile, setPackingFile] = useState<File | null>(null)
  const [issuePhoto, setIssuePhoto] = useState<File | null>(null)
  const [evidence, setEvidence] = useState<{photo?: string; signature?: string}>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const op = snapshot?.currentOperation
  const selectedId = params.get('id')
  const route = ((selectedId ? routes.find((r: any) => r.id === selectedId) : undefined) ||
    op?.route) as any
  const isCurrent = !selectedId || selectedId === op?.route?.id
  const kind = op?.kind || route?.mission_type || 'delivery'
  const closed = ['completed','issue','cancelled'].includes(String(route?.status||''))

  const ctx = route
    ? {routeId: route.id, driverId, companyId: route.company_id}
    : null

  useEffect(() => {
    let cancelled = false
    const loadEvidence = async () => {
      setEvidence({})
      if (!route) return
      const storage = getSupabase().storage.from('route-evidence')
      const [photo, signature] = await Promise.all([
        route.completion_photo_path ? storage.createSignedUrl(route.completion_photo_path, 900) : Promise.resolve({data: null}),
        route.customer_signature_path ? storage.createSignedUrl(route.customer_signature_path, 900) : Promise.resolve({data: null}),
      ])
      if (!cancelled) setEvidence({photo: photo.data?.signedUrl, signature: signature.data?.signedUrl})
    }
    void loadEvidence()
    return () => { cancelled = true }
  }, [route?.id, route?.completion_photo_path, route?.customer_signature_path])

  const act = async (action: 'arrive' | 'complete') => {
    if (!op || !isCurrent || busy || !route || !ctx) return
    setBusy(true)
    setMessage('')
    try {
      if (action === 'arrive') {
        await markArrived(ctx)
        try { await getCurrentLocation({maximumAge: 0}) } catch {}
        await refresh()
        setMessage(t.drvArrivedOk)
      } else {
        const isDelivery = operationLabel(String(kind)) === 'DELIVERY'
        let location
        try { location = await getCurrentLocation({maximumAge: 60_000}) } catch {}
        if (isDelivery) {
          await completeDeliveryWithRecipient(ctx, recipient, route.driver_note || '', location)
        } else if (operationLabel(String(kind)) === 'PICKUP') {
          await completePickupWithEvidence(ctx, packingFile || undefined)
        } else {
          await completeStop(ctx, {location})
        }
        try { window.sessionStorage.setItem('routehub:last-completed-id', route.id) } catch {}
        await refresh()
        router.push('/driver/completed')
        return
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setBusy(false)
    }
  }

  const pauseRoute = async () => {
    if (!ctx || busy) return
    setBusy(true)
    try {
      await updateRouteStatus(ctx, 'paused', operationalDate())
      await refresh()
      setMessage(t.drvPaused)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setBusy(false)
    }
  }

  const maps = () => {
    const url = openNavigation({
      address: route?.destination_address,
      coordinate:
        route?.destination_lat != null && route?.destination_lng != null
          ? {lat: Number(route.destination_lat), lng: Number(route.destination_lng)}
          : null,
      label: route?.destination_name,
    })
    if (url) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) window.location.assign(url)
    }
  }

  const openSheet = (s: Sheet) => {
    setSheetMsg('')
    setSheet(s)
  }

  const closeSheet = () => {
    if (sheetBusy) return
    setSheet(null)
    setSheetMsg('')
  }

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    }
  }

  const clearSignature = () => {
    const c = canvasRef.current
    if (!c) return
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
  }

  const savePhoto = async () => {
    if (!ctx || sheetBusy) return
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setSheetMsg(t.drvNeedPhoto)
      return
    }
    setSheetBusy(true)
    setSheetMsg('')
    try {
      await uploadStopPhoto(ctx, file)
      await refresh()
      setSheetMsg(t.drvSavedPhoto)
      setPhotoName('')
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => {
        setSheet(null)
        setSheetMsg('')
      }, 600)
    } catch (e) {
      setSheetMsg(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setSheetBusy(false)
    }
  }

  const saveNotes = async () => {
    if (!ctx || sheetBusy) return
    if (!note.trim()) {
      setSheetMsg(t.drvNeedNote)
      return
    }
    setSheetBusy(true)
    setSheetMsg('')
    try {
      await saveStopNote(ctx, note.trim())
      await refresh()
      setSheetMsg(t.drvNoteSaved)
      setNote('')
      setTimeout(() => {
        setSheet(null)
        setSheetMsg('')
      }, 600)
    } catch (e) {
      setSheetMsg(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setSheetBusy(false)
    }
  }

  const saveSignature = async () => {
    if (!ctx || sheetBusy || !canvasRef.current) return
    const c = canvasRef.current
    const ctx2d = c.getContext('2d')
    if (!ctx2d) return
    const pixels = ctx2d.getImageData(0, 0, c.width, c.height).data
    let hasInk = false
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) {
        hasInk = true
        break
      }
    }
    if (!hasInk) {
      setSheetMsg(t.drvNeedSign)
      return
    }
    setSheetBusy(true)
    setSheetMsg('')
    try {
      await saveStopSignature(ctx, c)
      await refresh()
      setSheetMsg(t.drvSigSaved)
      clearSignature()
      setTimeout(() => {
        setSheet(null)
        setSheetMsg('')
      }, 600)
    } catch (e) {
      setSheetMsg(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setSheetBusy(false)
    }
  }

  const saveIssue = async () => {
    if (!ctx || sheetBusy) return
    if (!issueCat) {
      setSheetMsg(t.drvPickCat)
      return
    }
    setSheetBusy(true)
    setSheetMsg('')
    try {
      const text = issueNote.trim() ? `${issueCat}: ${issueNote.trim()}` : issueCat
      await reportIssue(ctx, text, issuePhoto || undefined)
      await refresh()
      setSheetMsg(t.drvIssueSent)
      setIssueCat('')
      setIssueNote('')
      setIssuePhoto(null)
      setTimeout(() => {
        setSheet(null)
        setSheetMsg('')
      }, 600)
    } catch (e) {
      setSheetMsg(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setSheetBusy(false)
    }
  }

  const stackSub = route
    ? `Stop ${route.position || '—'} · ${(String(kind)==='pickup'?t.drvPickup:String(kind)==='branch'||String(kind)==='return'?t.drvReturn:t.drvDelivery)}`
    : undefined

  return (
    <DriverV3Shell
      active="route"
      mode="stack"
      title={t.drvStopDetails}
      subtitle={stackSub}
      backHref="/driver/route"
      backLabel="Route"
      hideNav={Boolean(sheet || confirmComplete)}
    >

      {loading ? (
        <section className="card"><p className="muted">{t.drvLoading}</p></section>
      ) : error ? (
        <section className="card"><p role="alert">{error}</p></section>
      ) : !route ? (
        <section className="card">
          <h2>{t.drvNoCurrentStop}</h2>
          <p className="muted">There is no active operation.</p>
        </section>
      ) : (
        <>
          <h1 className="title" style={{marginTop: 4, marginBottom: 4, fontSize: 26, lineHeight: '32px'}}>
            {route.destination_name || route.destination_address || t.drvCurrentStopName}
          </h1>
          <p className="muted" style={{marginTop: 0, marginBottom: 12}}>
            <MapPin size={14} style={{display: 'inline', verticalAlign: -2, marginRight: 4}} />
            {route.destination_address || 'Address unavailable'}
          </p>

          <section className="card">
            {route.destination_phone && (
              <p style={{margin: '0 0 8px'}}>
                <a
                  href={`tel:${route.destination_phone}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#1667F2',
                    fontWeight: 700,
                    textDecoration: 'none',
                    minHeight: 44,
                  }}
                >
                  <Phone size={16} />
                  {route.destination_phone}
                </a>
              </p>
            )}
            {route.order_number && (
              <p style={{margin: '0 0 8px'}}>
                <strong>{t.drvPoOrder}:</strong> {route.order_number}
              </p>
            )}
            {(route.instructions || route.notes) && (
              <p className="muted" style={{margin: '8px 0 0'}}>
                <strong style={{color: '#0F1D35'}}>{t.drvInstructions}: </strong>
                {route.instructions || route.notes}
              </p>
            )}

            {/* One-tap tiles — open in-app sheets, not new pages */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginTop: 16,
              }}
            >
              <button type="button" className="secondary" onClick={() => openSheet('photo')} style={tileStyle}>
                <Camera size={22} />
                {t.drvPhoto}
              </button>
              <button type="button" className="secondary" onClick={() => openSheet('signature')} style={tileStyle}>
                <PenLine size={22} />
                {t.drvSignature}
              </button>
              <button type="button" className="secondary" onClick={() => openSheet('notes')} style={tileStyle}>
                <FileText size={22} />
                {t.drvNotes}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => openSheet('issue')}
                style={{...tileStyle, color: '#EF5350', borderColor: '#f5c2c0'}}
              >
                <AlertTriangle size={22} />
                {t.drvIssue}
              </button>
            </div>

            {(evidence.photo || evidence.signature) && (
              <div style={{display: 'flex', gap: 8, marginTop: 14}}>
                {evidence.photo && <img src={evidence.photo} alt="" style={{width: 72, height: 72, objectFit: 'cover', borderRadius: 10}} />}
                {evidence.signature && <img src={evidence.signature} alt="" style={{width: 72, height: 72, objectFit: 'contain', borderRadius: 10, background: '#fff', border: '1px solid #DDE5EE'}} />}
              </div>
            )}

            <button className="secondary" onClick={maps} type="button" style={{marginTop: 14}}>
              <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                <Navigation size={18} />
                {t.drvOpenInMaps}
              </span>
            </button>
          </section>

          <div className={styles.stickyAction}>
            {!route.arrived_at ? (
              <button className="primary" disabled={busy || !isCurrent || closed} onClick={() => void act('arrive')}>
                {busy ? t.drvBusy : t.drvArrivedShort}
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy || !isCurrent || closed}
                onClick={() => setConfirmComplete(true)}
                style={{background: '#16B96B'}}
              >
                {busy ? t.drvBusy : (operationLabel(String(kind))==='PICKUP'?t.drvCompletePickup:operationLabel(String(kind))==='RETURN'?t.drvCompleteReturn:t.drvCompleteDelivery)}
              </button>
            )}
            {route.status === 'active' && (
              <button type="button" className="secondary" disabled={busy} onClick={() => void pauseRoute()} style={{marginTop: 8}}>
                {t.drvPause}
              </button>
            )}
            {message && (
              <p role="status" className="muted" style={{margin: 0, textAlign: 'center'}}>
                {message}
              </p>
            )}
          </div>
        </>
      )}

      {sheet &&
        typeof document !== 'undefined' &&
        createPortal(
        <div className={styles.sheetBackdrop} role="dialog" aria-modal="true" onClick={closeSheet}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
              <h2 className={styles.sheetTitle}>
                {sheet === 'photo' && t.drvPhoto}
                {sheet === 'signature' && t.drvSignature}
                {sheet === 'notes' && t.drvNotes}
                {sheet === 'issue' && t.drvReportIssue}
              </h2>
              <button
                type="button"
                className="secondary"
                onClick={closeSheet}
                style={{width: 44, minHeight: 44, padding: 0}}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {sheet === 'photo' && (
              <>
                <div className={styles.sheetBody}>
                  <label
                    className="secondary"
                    style={{
                      cursor: 'pointer',
                      marginBottom: 8,
                      minHeight: 112,
                      display: 'grid',
                      placeItems: 'center',
                      gap: 8,
                      fontSize: 16,
                    }}
                  >
                    <Camera size={28} />
                    {photoName || t.drvTakePhoto}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={e => setPhotoName(e.target.files?.[0]?.name || '')}
                    />
                  </label>
                </div>
                <div className={styles.sheetFooter}>
                  <button className="primary" disabled={sheetBusy} onClick={() => void savePhoto()}>
                    {sheetBusy ? t.drvSaving : t.drvSavePhoto}
                  </button>
                </div>
              </>
            )}

            {sheet === 'notes' && (
              <>
                <div className={styles.sheetBody}>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder={t.drvOptionalNote}
                    style={{marginBottom: 12}}
                  />
                </div>
                <div className={styles.sheetFooter}>
                  <button className="primary" disabled={sheetBusy} onClick={() => void saveNotes()}>
                    {sheetBusy ? t.drvSaving : t.drvSaveNote}
                  </button>
                </div>
              </>
            )}

            {sheet === 'signature' && (
              <>
                <div className={styles.sheetBody}>
                <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: 8}}>
                  <button
                    type="button"
                    className="secondary"
                    style={{width: 'auto', minHeight: 40, padding: '0 12px', fontSize: 13}}
                    onClick={clearSignature}
                  >
                    {t.drvClear}
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={220}
                  onPointerDown={e => {
                    const c = canvasRef.current
                    if (!c) return
                    c.setPointerCapture(e.pointerId)
                    drawing.current = true
                    const ctx2d = c.getContext('2d')
                    if (!ctx2d) return
                    const {x, y} = pointerPos(e)
                    ctx2d.lineWidth = 3
                    ctx2d.lineCap = 'round'
                    ctx2d.lineJoin = 'round'
                    ctx2d.strokeStyle = '#0F1D35'
                    ctx2d.beginPath()
                    ctx2d.moveTo(x, y)
                  }}
                  onPointerMove={e => {
                    if (!drawing.current || !canvasRef.current) return
                    const ctx2d = canvasRef.current.getContext('2d')
                    if (!ctx2d) return
                    const {x, y} = pointerPos(e)
                    ctx2d.lineTo(x, y)
                    ctx2d.stroke()
                  }}
                  onPointerUp={() => {
                    drawing.current = false
                  }}
                  onPointerCancel={() => {
                    drawing.current = false
                  }}
                  style={{
                    width: '100%',
                    height: 180,
                    background: '#fff',
                    border: '1px solid #DDE5EE',
                    borderRadius: 12,
                    touchAction: 'none',
                    marginBottom: 12,
                  }}
                />
                </div>
                <div className={styles.sheetFooter}>
                  <button className="primary" disabled={sheetBusy} onClick={() => void saveSignature()}>
                    {sheetBusy ? t.drvSaving : t.drvSaveSignature}
                  </button>
                </div>
              </>
            )}

            {sheet === 'issue' && (
              <>
                <div className={styles.sheetBody}>
                <div style={{display: 'grid', gap: 8, marginBottom: 12}}>
                  {ISSUE_CATEGORIES.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="secondary"
                      onClick={() => setIssueCat(c.id)}
                      style={{
                        justifyContent: 'flex-start',
                        paddingLeft: 14,
                        borderColor: issueCat === c.id ? '#1667F2' : undefined,
                        background: issueCat === c.id ? '#EAF2FF' : undefined,
                        color: issueCat === c.id ? '#1667F2' : undefined,
                        fontWeight: issueCat === c.id ? 800 : 600,
                      }}
                    >
                      {t[c.labelKey]}
                    </button>
                  ))}
                </div>
                <textarea
                  value={issueNote}
                  onChange={e => setIssueNote(e.target.value)}
                  placeholder={t.drvDetailsOpt}
                  style={{marginBottom: 12}}
                />
                <label className="secondary" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12}}>
                  <Camera size={18} />
                  {issuePhoto ? issuePhoto.name : t.drvTakePhoto}
                  <input type="file" accept="image/*" capture="environment" hidden onChange={e => setIssuePhoto(e.target.files?.[0] || null)} />
                </label>
                </div>
                <div className={styles.sheetFooter}>
                <button
                  className="primary"
                  disabled={sheetBusy || !issueCat}
                  onClick={() => void saveIssue()}
                  style={{background: '#EF5350'}}
                >
                  {sheetBusy ? 'Submitting…' : t.drvSubmitIssue}
                </button>
                </div>
              </>
            )}

            {sheetMsg && (
              <p role="status" className="muted" style={{marginTop: 12, textAlign: 'center'}}>
                {sheetMsg}
              </p>
            )}
          </div>
        </div>,
        document.body,
      )}

      {confirmComplete && route && (
        <div className={styles.confirmBackdrop} role="dialog" aria-modal="true">
          <div className={styles.confirmSheet}>
            <h2>{operationLabel(String(kind)) === 'PICKUP' ? t.drvCompletePickup : operationLabel(String(kind)) === 'RETURN' ? t.drvCompleteReturn : t.drvCompleteDelivery}</h2>
            <p>
              <strong style={{color: '#0f1d35'}}>{route.destination_name || route.destination_address}</strong>
              <br />
              Stop {route.position || '—'}
            </p>
            {operationLabel(String(kind)) === 'PICKUP' && (
              <label>
                {t.drvPacking}
                <input type="file" accept="image/*" capture="environment" onChange={e => setPackingFile(e.target.files?.[0] || null)} />
                {packingFile && <span className="muted">{packingFile.name}</span>}
              </label>
            )}
            {operationLabel(String(kind)) === 'DELIVERY' && (
              <label>
                {t.drvReceivedBy}
                <input
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder={t.drvRecipientName}
                  autoComplete="name"
                />
              </label>
            )}
            <div className={styles.confirmActions}>
              <button type="button" className="secondary" disabled={busy} onClick={() => setConfirmComplete(false)}>
                {t.drvCancel}
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy || (operationLabel(String(kind)) === 'DELIVERY' && !recipient.trim())}
                style={{background: '#16B96B'}}
                onClick={() => {
                  setConfirmComplete(false)
                  void act('complete')
                }}
              >
                {busy ? t.drvBusy : (operationLabel(String(kind))==='PICKUP'?t.drvCompletePickup:operationLabel(String(kind))==='RETURN'?t.drvCompleteReturn:t.drvCompleteDelivery)}
              </button>
            </div>
          </div>
        </div>
      )}
    </DriverV3Shell>
  )
}

const tileStyle = {
  minHeight: 72,
  display: 'grid',
  placeItems: 'center',
  gap: 4,
  padding: 8,
  fontSize: 12,
}
