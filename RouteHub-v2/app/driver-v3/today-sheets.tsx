'use client'

// The five completion/detail overlays Today can show (info, pickup, return,
// next stop, delivery) - split out of page.tsx verbatim (same JSX, same
// styles, no behavior change) since they were the largest single chunk of
// that file and don't need any of Today's own handler *definitions*, only
// the values/callbacks it already computes. Splitting this out only moves
// code; it does not change what any of it does.

import {Camera, PackageCheck, PackagePlus, PenLine, Phone, TriangleAlert, Warehouse, X} from 'lucide-react'
import type {RefObject} from 'react'
import styles from './today.module.css'

export const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,29,53,.58)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  display: 'grid',
  placeItems: 'center',
  padding: '20px',
  zIndex: 5000,
  touchAction: 'none',
  overscrollBehavior: 'none',
}
export const dialog: React.CSSProperties = {
  position: 'relative',
  width: 'min(340px,calc(100% - 32px))',
  padding: '18px 16px 16px',
  borderRadius: 20,
  background: '#f7f9fc',
  border: '1px solid #e5eaf0',
  boxShadow: '0 16px 36px rgba(15,29,53,.22)',
}
const tileBtn: React.CSSProperties = {
  minHeight: 72, display: 'grid', placeItems: 'center', gap: 4, padding: 8, fontSize: 12, lineHeight: '14px', textAlign: 'center', whiteSpace: 'normal',
}

function SheetHeader({label, onClose, t}: {label: string; onClose: () => void; t: any}) {
  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
      <p className="eyebrow" style={{margin: 0}}>{label}</p>
      <button type="button" aria-label={t.drvCancel || t.cancel} onClick={onClose} style={{width: 32, height: 32, border: 0, borderRadius: 16, background: '#e8eef4', color: '#0f1d35', display: 'grid', placeItems: 'center', padding: 0}}>
        <X size={16} />
      </button>
    </div>
  )
}

export function InfoSheet({route, kind, t, onClose, onOpenMaps}: {route: any; kind: string; t: any; onClose: () => void; onOpenMaps: () => void}) {
  return (
    <div style={overlay} onTouchMove={e => e.preventDefault()}>
      <section className="card" style={dialog} onClick={e => e.stopPropagation()}>
        <SheetHeader label={kind === 'pickup' ? t.drvPickup : kind === 'delivery' ? t.drvDelivery : t.drvReturn} onClose={onClose} t={t} />
        <h2 style={{margin: '0 0 4px', fontSize: 22}}>{route.destination_name || t.drvCurrentStopName}</h2>
        {route.destination_address && <p className="muted" style={{margin: '0 0 10px'}}>{route.destination_address}</p>}
        {kind !== 'return' && route.order_number ? <p style={{margin: '0 0 12px', fontSize: 22, fontWeight: 800}}>PO {route.order_number}</p> : null}
        <p style={{margin: '0 0 14px', fontSize: 14, lineHeight: 1.45, color: '#334155'}}>
          {kind === 'pickup' ? t.drvPickupHelp : kind === 'delivery' ? t.drvDeliveryHelp : (t.drvReturnHelp || t.drvReturn)}
        </p>
        {route.notes ? <p className="muted" style={{margin: '0 0 14px'}}>{route.notes}</p> : null}
        {route.destination_phone ? (
          <a href={`tel:${String(route.destination_phone).replace(/[^\d+]/g, '')}`} className="primary" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', marginBottom: 10}}>
            <Phone size={18} />{t.drvCall || 'Call'} {route.destination_phone}
          </a>
        ) : null}
        <button className="secondary" type="button" onClick={onOpenMaps}>{t.drvOpenMaps}</button>
      </section>
    </div>
  )
}

export function PickupSheet({route, t, busy, message, issueOpen, issueNote, onIssueNoteChange, onSavePickupNote, onConfirmPickup, onOpenIssue, onClose}: {
  route: any; t: any; busy: boolean; message: string; issueOpen: boolean; issueNote: string
  onIssueNoteChange: (value: string) => void; onSavePickupNote: () => void; onConfirmPickup: () => void; onOpenIssue: () => void; onClose: () => void
}) {
  return (
    <div style={overlay} onTouchMove={e => e.preventDefault()}>
      <section className="card" style={dialog} onClick={e => e.stopPropagation()}>
        <SheetHeader label={t.drvPickup} onClose={onClose} t={t} />
        <h2 style={{margin: '0 0 4px', fontSize: 22, lineHeight: '26px'}}>{route.destination_name || route.destination_address}</h2>
        {route.destination_address && <p className="muted" style={{margin: '0 0 8px', fontSize: 14}}>{route.destination_address}</p>}
        <p className="muted" style={{margin: '0 0 12px', fontSize: 13, lineHeight: '18px'}}>{t.drvPickupHelp}</p>
        {route.order_number ? (
          <div style={{margin: '0 0 16px', padding: '12px 14px', borderRadius: 14, background: '#fff', border: '1px solid #e5eaf0'}}>
            <p style={{margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#667280'}}>PO</p>
            <p style={{margin: '4px 0 0', fontSize: 28, lineHeight: '32px', fontWeight: 800, letterSpacing: '-0.03em'}}>{route.order_number}</p>
          </div>
        ) : null}
        {issueOpen ? (
          <>
            <textarea value={issueNote} onChange={e => onIssueNoteChange(e.target.value)} placeholder={t.drvOptionalNote} rows={3} style={{width: '100%', border: '1px solid #dde5ee', borderRadius: 12, padding: 10, font: 'inherit', marginBottom: 10}} />
            <button className="secondary" disabled={busy} onClick={onSavePickupNote}>{busy ? t.drvBusy : t.drvSubmitIssue}</button>
          </>
        ) : null}
        {message && <p className={styles.feedback} style={{marginTop: 8}}>{message}</p>}
        <button className="primary" disabled={busy} onClick={onConfirmPickup} style={{background: '#16B96B', width: '100%'}}>{busy ? t.drvBusy : t.drvConfirmPickup}</button>
        <button type="button" disabled={busy} onClick={onOpenIssue} style={{display: 'block', width: '100%', marginTop: 12, border: 0, background: 'transparent', color: '#E11D48', font: 'inherit', fontSize: 13, fontWeight: 700}}>{t.drvReportProblem}</button>
      </section>
    </div>
  )
}

export function ReturnSheet({route, t, busy, message, onComplete, onClose}: {route: any; t: any; busy: boolean; message: string; onComplete: () => void; onClose: () => void}) {
  return (
    <div style={overlay} onTouchMove={e => e.preventDefault()}>
      <section className="card" style={dialog} onClick={e => e.stopPropagation()}>
        <SheetHeader label={t.drvReturn} onClose={onClose} t={t} />
        <h2 style={{margin: '0 0 5px', fontSize: 22, lineHeight: '26px'}}>{route.destination_name || route.destination_address || t.drvReturn}</h2>
        {route.destination_address && <p className="muted" style={{margin: '0 0 12px', fontSize: 14}}>{route.destination_address}</p>}
        <p className="muted" style={{margin: '0 0 16px', fontSize: 14, lineHeight: '20px'}}>{t.drvReturnHelp || t.drvReturn}</p>
        {message && <p className={`${styles.feedback} ${styles.feedbackError}`}>{message}</p>}
        <button className="primary" disabled={busy} onClick={onComplete} style={{background: '#16B96B', width: '100%'}}>{busy ? t.drvBusy : t.drvCompleteReturn}</button>
      </section>
    </div>
  )
}

export function NextStopSheet({nextRoute, nextKind, nextLabel, t, onClose, onOpenMaps, onViewHistory}: {
  nextRoute: any; nextKind: string; nextLabel: string; t: any; onClose: () => void; onOpenMaps: () => void; onViewHistory: () => void
}) {
  const NextIcon = nextKind === 'pickup' ? PackagePlus : nextKind === 'delivery' ? PackageCheck : Warehouse
  return (
    <div style={overlay} onTouchMove={e => e.preventDefault()}>
      <section className="card" style={dialog} onClick={e => e.stopPropagation()}>
        <SheetHeader label={t.drvNextStop} onClose={onClose} t={t} />
        <span className={`${styles.typeBadge} ${styles[nextKind || 'return']}`} style={{marginBottom: 12}}><NextIcon />{nextLabel}</span>
        <h2 style={{margin: '0 0 4px', fontSize: 22, lineHeight: '26px'}}>{nextRoute.destination_name || nextRoute.destination_address || t.drvCurrentStopName}</h2>
        {nextRoute.destination_address && <p className="muted" style={{margin: '0 0 10px'}}>{nextRoute.destination_address}</p>}
        {nextKind !== 'return' && nextRoute.order_number ? <p style={{margin: '0 0 12px', fontSize: 22, fontWeight: 800}}>PO {nextRoute.order_number}</p> : null}
        <p style={{margin: '0 0 14px', fontSize: 14, lineHeight: 1.45, color: '#334155'}}>
          {nextKind === 'pickup' ? t.drvPickupHelp : nextKind === 'delivery' ? t.drvDeliveryHelp : (t.drvReturnHelp || t.drvReturn)}
        </p>
        {nextRoute.notes || nextRoute.driver_note ? <p className="muted" style={{margin: '0 0 14px'}}>{nextRoute.notes || nextRoute.driver_note}</p> : null}
        {nextRoute.destination_phone ? (
          <a href={`tel:${String(nextRoute.destination_phone).replace(/[^\d+]/g, '')}`} className="primary" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', marginBottom: 10}}>
            <Phone size={18} />{t.drvCall || 'Call'} {nextRoute.destination_phone}
          </a>
        ) : null}
        <div style={{display: 'grid', gap: 10}}>
          <button className="secondary" type="button" onClick={onOpenMaps}>{t.drvOpenMaps}</button>
          <button className="secondary" type="button" onClick={onViewHistory}>{t.routes || 'Routes'}</button>
        </div>
      </section>
    </div>
  )
}

export function DeliverySheet({
  route, t, recipient, onRecipientChange, photo, photoRef, onRequestPhoto, onPickPhoto, signed, podPanel, onPodPanelChange, issueNote, onIssueNoteChange,
  askName, nameFocus, onNameFocus, onNameBlur, nameRef, canvas, onSign, onClearSignature, busy, message, onConfirm, onClose,
}: {
  route: any; t: any
  recipient: string; onRecipientChange: (value: string) => void
  photo: File | null; photoRef: RefObject<HTMLInputElement>; onRequestPhoto: () => void; onPickPhoto: (file: File | null) => void
  signed: boolean; podPanel: null | 'photo' | 'signature' | 'notes' | 'issue'; onPodPanelChange: (panel: null | 'photo' | 'signature' | 'notes' | 'issue') => void
  issueNote: string; onIssueNoteChange: (value: string) => void
  askName: boolean; nameFocus: boolean; onNameFocus: () => void; onNameBlur: () => void; nameRef: RefObject<HTMLInputElement>
  canvas: RefObject<HTMLCanvasElement>; onSign: (e: React.PointerEvent<HTMLCanvasElement>) => void; onClearSignature: () => void
  busy: boolean; message: string; onConfirm: () => void; onClose: () => void
}) {
  return (
    <div style={overlay} onTouchMove={e => e.preventDefault()}>
      <section className="card" style={dialog} onClick={e => e.stopPropagation()}>
        <SheetHeader label={t.drvDelivery} onClose={onClose} t={t} />
        <h2 style={{margin: '0 0 4px', fontSize: 22, lineHeight: '26px'}}>{route.destination_name || t.drvCompleteDelivery}</h2>
        {route.destination_address && <p className="muted" style={{margin: '0 0 8px', fontSize: 14}}>{route.destination_address}</p>}
        <p className="muted" style={{margin: '0 0 12px', fontSize: 13, lineHeight: '18px'}}>{t.drvDeliveryHelp}</p>
        {route.order_number ? (
          <div style={{margin: '0 0 12px', padding: '12px 14px', borderRadius: 14, background: '#fff', border: '1px solid #e5eaf0'}}>
            <p style={{margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#667280'}}>PO</p>
            <p style={{margin: '4px 0 0', fontSize: 28, lineHeight: '32px', fontWeight: 800}}>{route.order_number}</p>
          </div>
        ) : null}
        <label className="muted" style={{display: 'block', marginBottom: 12, padding: askName ? '12px' : '0', borderRadius: 14, background: askName ? '#fff7ed' : 'transparent', border: askName ? '1px solid #fdba74' : '0'}}>
          {t.drvReceivedBy}
          <input ref={nameRef} value={recipient} onFocus={onNameFocus} onBlur={onNameBlur} onChange={e => onRecipientChange(e.target.value)} placeholder={t.drvRecipientName} style={{display: 'block', width: '100%', minHeight: 48, marginTop: 6, border: '1px solid #dde5ee', borderRadius: 12, padding: '0 12px', font: 'inherit', boxSizing: 'border-box', background: '#fff'}} />
        </label>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={e => onPickPhoto(e.target.files?.[0] || null)} />
        {!nameFocus && (
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12}}>
            <button type="button" className="secondary" onClick={onRequestPhoto} style={{...tileBtn, color: photo ? '#16B96B' : undefined}}>
              <Camera size={20} />{t.drvPhoto || 'Foto'}
            </button>
            <button type="button" className="secondary" onClick={() => onPodPanelChange(podPanel === 'signature' ? null : 'signature')} style={{...tileBtn, color: signed ? '#16B96B' : undefined}}>
              <PenLine size={20} />{t.drvSignature || 'Firma'}
            </button>
            <button type="button" className="secondary" onClick={() => onPodPanelChange(podPanel === 'issue' ? null : 'issue')} style={{...tileBtn, color: '#EF5350', borderColor: '#f5c2c0'}}>
              <TriangleAlert size={20} />{t.drvIssue}
            </button>
          </div>
        )}
        {!nameFocus && podPanel === 'signature' && (
          <div style={{marginBottom: 10}}>
            <canvas ref={canvas} width={340} height={180} onPointerDown={onSign} onPointerMove={e => e.buttons === 1 && onSign(e)} style={{width: '100%', height: 180, border: '1px dashed #cbd5e1', borderRadius: 12, background: '#fff', touchAction: 'none'}} />
            <button type="button" className="secondary" onClick={onClearSignature} style={{marginTop: 8, width: '100%'}}>{t.drvClear}</button>
          </div>
        )}
        {!nameFocus && podPanel === 'issue' && (
          <textarea value={issueNote} onChange={e => onIssueNoteChange(e.target.value)} placeholder={t.drvOptionalNote} rows={3} style={{width: '100%', border: '1px solid #dde5ee', borderRadius: 12, padding: 10, font: 'inherit', marginBottom: 10, boxSizing: 'border-box'}} />
        )}
        {message && <p className={`${styles.feedback} ${styles.feedbackError}`}>{message}</p>}
        <button className="primary" disabled={busy} onClick={onConfirm} style={{background: podPanel === 'issue' ? '#E11D48' : '#16B96B', width: '100%'}}>{busy ? t.drvBusy : (podPanel === 'issue' ? (t.drvCompleteWithIssue || 'COMPLETE WITH ISSUE') : t.drvCompleteDelivery)}</button>
      </section>
    </div>
  )
}
