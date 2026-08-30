'use client'
import {useRef, useState} from 'react'
import {useRouter} from 'next/navigation'
import {Camera, FileText, PenLine} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import shellStyles from '../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {saveStopNote, uploadStopPhoto, saveStopSignature} from '../../../lib/driver-v3/actions'
import {useLocale} from '../../../lib/use-preferences'

export default function Pod() {
  const router = useRouter()
  const {t} = useLocale()
  const {driverId, snapshot, refresh} = useDriverData()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'ok' | 'err'>('ok')
  const [photoName, setPhotoName] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const route = snapshot?.currentOperation?.route as any
  const drawing = useRef(false)

  const clearSignature = () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
  }

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    const scaleX = c.width / r.width
    const scaleY = c.height / r.height
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY,
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current
    if (!c) return
    c.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = c.getContext('2d')
    if (!ctx) return
    const {x, y} = pointerPos(e)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0F1D35'
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const {x, y} = pointerPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const onPointerUp = () => {
    drawing.current = false
  }

  const submit = async () => {
    if (!route || busy) return
    setBusy(true)
    setMessage('')
    try {
      const ctx = {routeId: route.id, driverId, companyId: route.company_id}
      let saved = false
      if (note.trim()) {
        await saveStopNote(ctx, note)
        saved = true
      }
      if (file.current?.files?.[0]) {
        await uploadStopPhoto(ctx, file.current.files[0])
        saved = true
      }
      if (canvas.current) {
        // Only save signature if canvas has strokes (non-empty)
        const ctx2d = canvas.current.getContext('2d')
        if (ctx2d) {
          const pixels = ctx2d.getImageData(0, 0, canvas.current.width, canvas.current.height).data
          let hasInk = false
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] > 0) {
              hasInk = true
              break
            }
          }
          if (hasInk) {
            await saveStopSignature(ctx, canvas.current)
            saved = true
          }
        }
      }
      if (!saved) {
        setMessageType('err')
        setMessage('Add a photo, note, or signature before saving.')
        return
      }
      await refresh()
      setMessageType('ok')
      setMessage('Proof saved.')
      setNote('')
      setPhotoName('')
      if (file.current) file.current.value = ''
      clearSignature()
      router.replace('/driver/stop')
    } catch (e) {
      setMessageType('err')
      setMessage(e instanceof Error ? e.message : "Couldn't save the photo. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="route" mode="stack" title={t.drvNotes} backHref="/driver/stop" backLabel={t.drvRoute}>
      

      {!route ? (
        <section className="card">
          <p className="muted">{t.drvNoCurrentStop}</p>
        </section>
      ) : (
        <>
          <section className="card">
            <p className="eyebrow">{t.drvCurrentStop}</p>
            <h2 style={{margin: '4px 0 0', fontSize: 18}}>
              {route.destination_name || route.destination_address || 'Stop'}
            </h2>
            {route.order_number && (
              <p className="muted" style={{margin: '4px 0 0'}}>
                PO {route.order_number}
              </p>
            )}
          </section>

          <section className="card">
            <p className="eyebrow" style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <Camera size={14} /> PHOTO
            </p>
            <label className="secondary" style={{cursor: 'pointer', marginTop: 8}}>
              {photoName || t.drvTakePhoto}
              <input
                ref={file}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={e => setPhotoName(e.target.files?.[0]?.name || '')}
              />
            </label>
          </section>

          <section className="card">
            <p className="eyebrow" style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <FileText size={14} /> NOTES
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t.drvOptionalNote}
              style={{marginTop: 8}}
            />
          </section>

          <section className="card">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <p className="eyebrow" style={{display: 'flex', alignItems: 'center', gap: 6, margin: 0}}>
                <PenLine size={14} /> CUSTOMER SIGNATURE
              </p>
              <button
                type="button"
                className="secondary"
                style={{minHeight: 36, width: 'auto', padding: '0 12px', fontSize: 12}}
                onClick={clearSignature}
              >
                Clear
              </button>
            </div>
            <canvas
              ref={canvas}
              width={700}
              height={220}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                width: '100%',
                height: 180,
                background: '#fff',
                border: '1px solid #DDE5EE',
                borderRadius: 12,
                touchAction: 'none',
                marginTop: 10,
              }}
            />
          </section>

          <div className={shellStyles.stickyAction}>
            <button className="primary" disabled={busy} onClick={() => void submit()}>
              {busy ? t.drvSaving : t.drvSaveEvidence}
            </button>
            {message && (
              <p
                role="status"
                className="muted"
                style={{
                  margin: 0,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: messageType === 'ok' ? '#EAF9F1' : '#FFF0F0',
                  color: messageType === 'ok' ? '#147a4a' : '#b42318',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {message}
              </p>
            )}
          </div>
        </>
      )}
    </DriverV3Shell>
  )
}
