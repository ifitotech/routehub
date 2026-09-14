'use client'

// Abstract A -> B route visual for the Today hero - never a real map (no
// tiles, no streets, no geographic names, no embedded navigation). Purely
// illustrative context for "this is the shape of the current stop's trip",
// matching the approved dark-premium concept exactly: a glowing blue origin
// dot labeled with where the driver starts from, a glowing teal destination
// pin labeled with the stop's own name, joined by a curved line. Tapping it
// (where wired up) hands off to the same external Maps deep link "Open
// Maps" already uses - this component never becomes a navigable surface
// itself.
export default function RouteGlyph({active = false, originLabel, destLabel}: {active?: boolean; originLabel: string; destLabel: string}) {
  return (
    <div style={{position: 'relative', width: '100%', height: '100%'}}>
      <svg viewBox="0 0 320 130" width="100%" height="100%" role="img" aria-hidden="true" style={{display: 'block', overflow: 'visible'}}>
        <defs>
          <linearGradient id="rh-route-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1677FF" />
            <stop offset="100%" stopColor="#17D9D2" />
          </linearGradient>
        </defs>
        {/* Base track - always present, faint */}
        <path d="M28,96 C 90,96 70,40 150,40 S 260,18 292,34" fill="none" stroke="rgba(35,104,205,.20)" strokeWidth="4" strokeLinecap="round" />
        {/* Active/traveled segment - solid once the route has actually
            started, dashed (pending) before that. */}
        <path d="M28,96 C 90,96 70,40 150,40 S 260,18 292,34" fill="none" stroke="url(#rh-route-line)" strokeWidth="4" strokeLinecap="round" strokeDasharray={active ? undefined : '6 10'} opacity={active ? 1 : .45} />
        {/* Origin */}
        <circle cx="28" cy="96" r="12" fill="rgba(22,119,255,.10)" />
        <circle cx="28" cy="96" r="7" fill="#1677FF" style={{filter: 'drop-shadow(0 0 10px rgba(22,119,255,.55))'}} />
        <circle cx="28" cy="96" r="3" fill="#fff" />
        {/* Destination */}
        <circle cx="292" cy="34" r="13" fill="rgba(23,217,210,.10)" />
        <circle cx="292" cy="34" r="7.5" fill="#17D9D2" style={{filter: 'drop-shadow(0 0 12px rgba(23,217,210,.5))'}} />
        <circle cx="292" cy="34" r="3" fill="#fff" />
      </svg>
      <span aria-hidden="true" style={labelStyle('8.75%', '73.8%', 'left')}>{originLabel}</span>
      <span aria-hidden="true" style={labelStyle('91.25%', '26.2%', 'right')}>{destLabel}</span>
    </div>
  )
}

function labelStyle(left: string, top: string, align: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    left,
    top: `calc(${top} + 16px)`,
    transform: align === 'left' ? 'translateX(-38%)' : 'translateX(-62%)',
    textAlign: align,
    color: 'var(--rh-text-muted, #9FB2D0)',
    fontSize: 10.5,
    fontWeight: 750,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    maxWidth: 130,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }
}
