'use client'
import {useRef, useState} from 'react'
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
  saveStopNote,
  uploadStopPhoto,
  saveStopSignature,
  reportIssue,
} from '../../../lib/driver-v3/actions'
import {openNavigation} from '../../../lib/maps/external-navigation'

const operationLabel = (kind: string) =>
  kind === 'branch' ? 'RETURN' : kind === 'pickup' ? 'PICKUP' : 'DELIVERY'

const ISSUE_CATEGORIES = [
  'Customer unavailable',
  'Wrong address',
  'Damaged item',
  'Access problem',
  'Other',
] as const

type Sheet = 'photo' | 'signature' | 'notes' | 'issue' | null

export default function DriverV3Stop() {
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
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const op = snapshot?.currentOperation
  const selectedId = params.get('id')
  const route = ((selectedId ? routes.find((r: any) => r.id === selectedId) : undefined) ||
    op?.route) as any
  const isCurrent = !selectedId || selectedId === op?.route?.id
  const kind = op?.kind || route?.mission_type || 'delivery'

  const ctx = route
    ? {routeId: route.id, driverId, companyId: route.company_id}
    : null

  const act = async (action: 'arrive' | 'complete') => {
    if (!op || !isCurrent || busy || !route || !ctx) return
    setBusy(true)
    setMessage('')
    try {
      if (action === 'arrive') {
        await markArrived(ctx)
        await refresh()
        setMessage('Arrival recorded.')
      } else {
        await completeStop(ctx)
        await refresh()
        router.push('/driver/completed')
        return
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to update stop.')
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
      setSheetMsg('Choose a photo first.')
      return
    }
    setSheetBusy(true)
    setSheetMsg('')
    try {
      await uploadStopPhoto(ctx, file)
      await refresh()
      setSheetMsg('Photo saved.')
      setPhotoName('')
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => {
        setSheet(null)
        setSheetMsg('')
      }, 600)
    } catch (e) {
      setSheetMsg(e instanceof Error ? e.message : "Couldn't save the photo.")
    } finally {
      setSheetBusy(false)
    }
  }

  const saveNotes = async () => {
    if (!ctx || sheetBusy) return
    if (!note.trim()) {
      setSheetMsg('Write a note first.')
      return
    }
    setSheetBusy(true)
    setSheetMsg('')
    try {
      await saveStopNote(ctx, note.trim())
      await refresh()
      setSheetMsg('Note saved.')
      setNote('')
      setTimeout(() => {
        setSheet(null)
        setSheetMsg('')
      }, 600)
    } catch (e) {
      setSheetMsg(e instanceof Error ? e.message : 'Unable to save note.')
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
      setSheetMsg('Customer must sign first.')
      return
    }
    setSheetBusy(true)
    setSheetMsg('')
    try {
      await saveStopSignature(ctx, c)
      await refresh()
      setSheetMsg('Signature saved.')
      clearSignature()
      setTimeout(() => {
        setSheet(null)
        setSheetMsg('')
      }, 600)
    } catch (e) {
      setSheetMsg(e instanceof Error ? e.message : 'Unable to save signature.')
    } finally {
      setSheetBusy(false)
    }
  }

  const saveIssue = async () => {
    if (!ctx || sheetBusy) return
    if (!issueCat) {
      setSheetMsg('Select a category.')
      return
    }
    setSheetBusy(true)
    setSheetMsg('')
    try {
      const text = issueNote.trim() ? `${issueCat}: ${issueNote.trim()}` : issueCat
      await reportIssue(ctx, text)
      await refresh()
      setSheetMsg('Issue submitted.')
      setIssueCat('')
      setIssueNote('')
      setTimeout(() => {
        setSheet(null)
        setSheetMsg('')
      }, 600)
    } catch (e) {
      setSheetMsg(e instanceof Error ? e.message : 'Unable to submit issue.')
    } finally {
      setSheetBusy(false)
    }
  }

  const stackSub = route
    ? `Stop ${route.position || '—'} · ${operationLabel(String(kind))}`
    : undefined

  return (
    <DriverV3Shell
      active="route"
      mode="stack"
      title="Stop Details"
      subtitle={stackSub}
      backHref="/driver/route"
      backLabel="Route"
      hideNav={Boolean(sheet || confirmComplete)}
    >

      {loading ? (
        <section className="card"><p>Loading stop…</p></section>
      ) : error ? (
        <section className="card"><p role="alert">{error}</p></section>
      ) : !route ? (
        <section className="card">
          <h2>No current stop</h2>
          <p className="muted">There is no active operation.</p>
        </section>
      ) : (
        <>
          <p className="eyebrow" style={{color: '#1667F2'}}>
            {operationLabel(String(kind))}
          </p>
          <h1 className="title" style={{marginBottom: 4, fontSize: 26, lineHeight: '32px'}}>
            {route.destination_name || route.destination_address || 'Current stop'}
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
                <strong>PO / Order:</strong> {route.order_number}
              </p>
            )}
            {(route.instructions || route.notes) && (
              <p className="muted" style={{margin: '8px 0 0'}}>
                <strong style={{color: '#0F1D35'}}>Instructions: </strong>
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
                Photo
              </button>
              <button type="button" className="secondary" onClick={() => openSheet('signature')} style={tileStyle}>
                <PenLine size={22} />
                Signature
              </button>
              <button type="button" className="secondary" onClick={() => openSheet('notes')} style={tileStyle}>
                <FileText size={22} />
                Notes
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => openSheet('issue')}
                style={{...tileStyle, color: '#EF5350', borderColor: '#f5c2c0'}}
              >
                <AlertTriangle size={22} />
                Issue
              </button>
            </div>

            <button className="secondary" onClick={maps} type="button" style={{marginTop: 14}}>
              <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                <Navigation size={18} />
                Open in Maps
              </span>
            </button>
          </section>

          <div className={styles.stickyAction}>
            {!route.arrived_at ? (
              <button className="primary" disabled={busy || !isCurrent} onClick={() => void act('arrive')}>
                {busy ? 'Updating…' : 'ARRIVED AT STOP'}
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy || !isCurrent}
                onClick={() => setConfirmComplete(true)}
                style={{background: '#16B96B'}}
              >
                {busy ? 'Completing…' : `COMPLETE ${operationLabel(String(kind))}`}
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
                {sheet === 'photo' && 'Photo'}
                {sheet === 'signature' && 'Signature'}
                {sheet === 'notes' && 'Notes'}
                {sheet === 'issue' && 'Report issue'}
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
                    {photoName || 'Take photo'}
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
                    {sheetBusy ? 'Saving…' : 'SAVE PHOTO'}
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
                    placeholder="Optional delivery note"
                    style={{marginBottom: 12}}
                  />
                </div>
                <div className={styles.sheetFooter}>
                  <button className="primary" disabled={sheetBusy} onClick={() => void saveNotes()}>
                    {sheetBusy ? 'Saving…' : 'SAVE NOTE'}
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
                    Clear
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
                    {sheetBusy ? 'Saving…' : 'SAVE SIGNATURE'}
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
                      key={c}
                      type="button"
                      className="secondary"
                      onClick={() => setIssueCat(c)}
                      style={{
                        justifyContent: 'flex-start',
                        paddingLeft: 14,
                        borderColor: issueCat === c ? '#1667F2' : undefined,
                        background: issueCat === c ? '#EAF2FF' : undefined,
                        color: issueCat === c ? '#1667F2' : undefined,
                        fontWeight: issueCat === c ? 800 : 600,
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <textarea
                  value={issueNote}
                  onChange={e => setIssueNote(e.target.value)}
                  placeholder="Details (optional)"
                  style={{marginBottom: 12}}
                />
                </div>
                <div className={styles.sheetFooter}>
                <button
                  className="primary"
                  disabled={sheetBusy || !issueCat}
                  onClick={() => void saveIssue()}
                  style={{background: '#EF5350'}}
                >
                  {sheetBusy ? 'Submitting…' : 'SUBMIT ISSUE'}
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
            <h2>Complete this {operationLabel(String(kind)).toLowerCase()}?</h2>
            <p>
              <strong style={{color: '#0f1d35'}}>{route.destination_name || route.destination_address}</strong>
              <br />
              Stop {route.position || '—'}
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className="secondary" disabled={busy} onClick={() => setConfirmComplete(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy}
                style={{background: '#16B96B'}}
                onClick={() => {
                  setConfirmComplete(false)
                  void act('complete')
                }}
              >
                {busy ? 'Completing…' : `Complete ${operationLabel(String(kind))}`}
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
