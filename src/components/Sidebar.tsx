import { useState, useEffect } from 'react'
import { T, SOURCES } from './ui'

type Props = {
  activeSource: string
  onSourceChange: (id: string) => void
  forceExpanded?: boolean
}

// Live HH:MM:SS readout in the sidebar footer — the interface is awake.
function SidebarClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9,
      color: T.mute,
      letterSpacing: '0.1em',
      fontWeight: 400,
    }}>
      {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
    </div>
  )
}

export default function Sidebar({ activeSource, onSourceChange, forceExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(forceExpanded)
  useEffect(() => setExpanded(forceExpanded), [forceExpanded])

  const width = expanded ? 172 : 44

  return (
    <div
      onMouseEnter={() => !forceExpanded && setExpanded(true)}
      onMouseLeave={() => !forceExpanded && setExpanded(false)}
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${T.border}`,
        width,
        background: T.card,
        transition: 'width 200ms ease',
        overflow: 'hidden',
      }}
    >
      {/* Hamburger + SOURCES label header */}
      <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: 10, height: 40 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <line x1="2" y1="5"  x2="14" y2="5"  stroke={T.text3} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="2" y1="8"  x2="14" y2="8"  stroke={T.text3} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="2" y1="11" x2="14" y2="11" stroke={T.text3} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {expanded && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: T.mute,
            whiteSpace: 'nowrap',
            fontWeight: 400,
          }}>sources</span>
        )}
      </div>

      {/* Source filter buttons */}
      <div style={{ flex: 1, padding: '8px 8px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SOURCES.map(s => {
          const active = activeSource === s.id
          const disabled = !s.count  // sources with no count are not yet wired up
          return (
            <button
              key={s.id}
              onClick={() => !disabled && onSourceChange(s.id)}
              style={{
                all: 'unset',
                cursor: disabled ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 8px',
                borderRadius: 6,
                background: active ? 'rgba(0,0,0,0.04)' : 'transparent',
                opacity: disabled ? 0.32 : 1,
                transition: 'background 200ms, opacity 200ms',
              }}
            >
              {/* Active row: orange accent dot. Inactive: source's own color */}
              <div style={{
                width: 6, height: 6, borderRadius: 999,
                background: active ? T.orange : s.color,
                flexShrink: 0,
              }} />
              {expanded && (
                <>
                  <span style={{
                    flex: 1,
                    textAlign: 'left',
                    fontSize: 12,
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: active ? 500 : 400,
                    color: active ? T.text : T.text2,
                    whiteSpace: 'nowrap',
                  }}>{s.label}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: T.mute,
                    fontWeight: 400,
                  }}>{s.count ?? '—'}</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* Live clock footer — only when expanded */}
      {expanded && (
        <div style={{ padding: '10px 14px 14px' }}>
          <SidebarClock />
        </div>
      )}
    </div>
  )
}
