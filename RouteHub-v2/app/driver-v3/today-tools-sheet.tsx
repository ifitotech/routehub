'use client'

import {Map, Phone, TriangleAlert, X} from 'lucide-react'

// Everything that used to sit next to the primary Start/Complete button
// (Open Maps, Call, Report an issue) moves in here instead - the same
// three real actions, same handlers, just reachable one tap away through
// Tools rather than crowding the hero's main call-to-action. Call only
// ever renders when the stop actually has a phone number.
export default function ToolsSheet({
  phone,
  onOpenMaps,
  onCall,
  onReportIssue,
  onClose,
  labels,
}: {
  phone?: string | null
  onOpenMaps: () => void
  onCall?: () => void
  onReportIssue: () => void
  onClose: () => void
  labels: {title: string; maps: string; call: string; issue: string; close: string}
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(3,10,20,.55)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        animation: 'rhToolsFade .18s ease',
      }}
    >
      <section
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, boxSizing: 'border-box',
          background: 'rgba(7,25,51,.96)', border: '1px solid rgba(112,170,255,.18)',
          borderRadius: '18px 18px 0 0', boxShadow: '0 20px 48px rgba(0,0,0,.42)',
          padding: '10px 14px calc(16px + env(safe-area-inset-bottom))',
          animation: 'rhToolsUp .22s ease',
        }}
      >
        <div style={{width: 40, height: 4, borderRadius: 999, background: 'rgba(112,170,255,.28)', margin: '4px auto 14px'}} />
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
          <p style={{margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6F86AA'}}>{labels.title}</p>
          <button type="button" aria-label={labels.close} onClick={onClose} style={{width: 32, height: 32, border: 0, borderRadius: 16, background: 'rgba(255,255,255,.06)', color: '#F7FAFF', display: 'grid', placeItems: 'center', padding: 0}}>
            <X size={16} />
          </button>
        </div>

        <ToolRow icon={<Map size={19} color="#63AEFF" />} label={labels.maps} onClick={onOpenMaps} />
        {phone && onCall && <ToolRow icon={<Phone size={19} color="#63AEFF" />} label={`${labels.call} ${phone}`} onClick={onCall} />}
        <ToolRow icon={<TriangleAlert size={19} color="#FFB547" />} label={labels.issue} onClick={onReportIssue} accent />
      </section>
      <style>{`
        @keyframes rhToolsFade{from{opacity:0}to{opacity:1}}
        @keyframes rhToolsUp{from{transform:translateY(20px);opacity:.6}to{transform:none;opacity:1}}
      `}</style>
    </div>
  )
}

function ToolRow({icon, label, onClick, accent}: {icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 48, padding: '10px 8px',
        border: 0, borderRadius: 12, background: 'transparent', color: accent ? '#FFB547' : '#F7FAFF',
        font: 'inherit', fontSize: 15, fontWeight: 700, textAlign: 'left', touchAction: 'manipulation',
      }}
      onTouchStart={e => (e.currentTarget.style.background = 'rgba(22,119,255,.16)')}
      onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      <span style={{color: accent ? '#F7FAFF' : undefined}}>{label}</span>
    </button>
  )
}
