import { useState, useEffect } from 'react'

const sources = [
  { id: "all",    label: "All",    count: "36", color: "#C8BEA8", bar: null },
  { id: "notion", label: "Notion", count: "36", color: "#5B7B8A", bar: 0.8  }, // 80% full — 36 of ~45 capacity
  { id: "gmail",  label: "Gmail",  count: null,  color: "#8A5B5B", bar: null },
  { id: "photos", label: "Photos", count: null,  color: "#8A7A5B", bar: null },
  { id: "audio",  label: "Audio",  count: null,  color: "#5B6E8A", bar: null },
]

type Props = {
  activeSource: string
  onSourceChange: (id: string) => void
}

function getClockParts() {
  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
  return { time, date }
}

export default function Sidebar({ activeSource, onSourceChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [clock, setClock] = useState(getClockParts())

  // Refresh clock every 30s — cheap, stays accurate within half a minute
  useEffect(() => {
    const id = setInterval(() => setClock(getClockParts()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="flex-shrink-0 flex flex-col border-r border-[#2E2B26] transition-all duration-[220ms] overflow-hidden"
      style={{
        width: expanded ? 164 : 40,
        background: 'rgba(0,0,0,0.15)',
        transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Drag region — clears macOS traffic lights (positioned at y:18 in app/main.js)
          and lets the user drag the window from the top of the sidebar */}
      <div
        className="h-12 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as any}
      />

      {/* ≡ readout icon + SOURCES label (label appears only when expanded) */}
      <div className="px-3 mb-4 flex items-center gap-2 h-7">
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none">
          <line x1="2" y1="5"  x2="14" y2="5"  stroke="#7A7060" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="2" y1="8"  x2="14" y2="8"  stroke="#7A7060" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="2" y1="11" x2="14" y2="11" stroke="#7A7060" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {expanded && (
          <span
            className="text-[9px] tracking-widest uppercase text-[#4A463F] whitespace-nowrap"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Sources
          </span>
        )}
      </div>

      {/* Source filter items */}
      <div className="flex-1 px-2 flex flex-col gap-2" style={{ paddingTop: '36px' }}>
        {sources.map(s => {
          const active = activeSource === s.id
          return (
            <button
              key={s.id}
              onClick={() => s.count && onSourceChange(s.id)}
              className={`flex flex-col px-2 py-2 rounded-md w-full transition-all
                ${active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}
                ${!s.count ? 'opacity-35 cursor-default' : 'cursor-pointer'}`}
            >
              {/* Dot + label + count row */}
              <div className="flex items-center gap-2.5 w-full">
                {/* Active source: orange accent dot. Inactive: source's own color */}
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: active ? '#E8590C' : s.color }}
                />
                {expanded && (
                  <>
                    <span className={`text-[12px] flex-1 text-left whitespace-nowrap
                      ${active ? 'text-[#C8BEA8] font-medium' : 'text-[#7A7060]'}`}>
                      {s.label}
                    </span>
                    <span
                      className="text-[10px] text-[#4A463F] ml-auto"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {s.count ?? '—'}
                    </span>
                  </>
                )}
              </div>

              {/* 4px data-density bar — only when expanded and source has embedded data */}
              {expanded && s.bar !== null && (
                <div className="mt-1.5 h-[4px] w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full"
                    style={{ width: `${s.bar * 100}%`, background: s.color, opacity: 0.7 }}
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Live clock footer — only visible when sidebar is expanded */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-2 border-t border-[#2E2B26]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <p className="text-[9px] text-[#7A7060] leading-tight">{clock.time}</p>
          <p className="text-[9px] text-[#7A7060] leading-tight">{clock.date}</p>
        </div>
      )}
    </div>
  )
}
