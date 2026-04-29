import { useState, useEffect, type CSSProperties, type ReactNode } from "react"

// ─── Design tokens ───────────────────────────────────────────────────────────
// Light instrument-panel palette. `bg` and `card` are #FAFAFA (kit default);
// everything else is verbatim from the kit tokens.
export const T = {
  bg:      '#FAFAFA',
  card:    '#FFFFFF',
  border:  '#E5E5E5',
  border2: '#EEEEEE',
  text:    '#000000',
  text2:   '#5A5A5A',
  text3:   '#8A8A8A',
  mute:    '#BDBDBD',
  mute2:   '#D8D8D8',
  block:   '#1A1A1A',
  blockOff:'#E8E8E8',
  orange:  '#E8590C',
  notion:  '#5B7B8A',
  amber:   '#D99C2B',
  green:   '#4A9D5F',
} as const

// ─── Source registry (shared between Sidebar and AnswerPanel) ───────────────
export const SOURCES = [
  { id: 'all',         label: 'all',         count: '36' as string | null,  color: T.text2 },
  { id: 'notion',      label: 'notion',      count: '36' as string | null,  color: T.notion },
  { id: 'apple_notes', label: 'apple_notes', count: '65' as string | null,  color: T.amber },
  { id: 'gmail',       label: 'gmail',       count: null as string | null,  color: '#8A5B5B' },
  { id: 'photos',      label: 'photos',      count: '184' as string | null, color: '#8A7A5B' },
  { id: 'audio',       label: 'audio',       count: null as string | null,  color: '#5B6E8A' },
]

// ─── Tile ────────────────────────────────────────────────────────────────────
// Uniform bordered container used across the dashboard. `dotGrid` paints the
// subtle radial-dot texture behind the clock tile; `orangeDot` prepends an
// orange status dot next to the label.
type TileProps = {
  label?: string
  children?: ReactNode
  style?: CSSProperties
  pad?: number
  dotGrid?: boolean
  orangeDot?: boolean
}

export function Tile({ label, children, style, pad = 14, dotGrid = false, orangeDot = false }: TileProps) {
  return (
    <div style={{
      // Longhand so it doesn't clobber the `backgroundImage` dot grid below.
      backgroundColor: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      padding: pad,
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: dotGrid ? 'radial-gradient(circle, #D0D0D0 0.8px, transparent 0.8px)' : undefined,
      backgroundSize: dotGrid ? '8px 8px' : undefined,
      ...style,
    }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {orangeDot && <div style={{ width: 6, height: 6, borderRadius: 999, background: T.orange }} />}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: T.text3, fontWeight: 400,
          }}>{label}</span>
        </div>
      )}
      {children}
    </div>
  )
}

// ─── BlockBar ───────────────────────────────────────────────────────────────
// Square-segment progress bar (Nothing OS data grammar). `value` is 0–1.
type BlockBarProps = {
  value: number
  total?: number
  color?: string
  height?: number
  blockW?: number
  gap?: number
}

export function BlockBar({ value, total = 20, color = T.block, height = 8, blockW = 8, gap = 2 }: BlockBarProps) {
  const lit = Math.round(value * total)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: blockW, height,
          background: i < lit ? color : T.blockOff,
          borderRadius: 1,
        }} />
      ))}
    </div>
  )
}

// ─── Dot-matrix clock (SVG, not a font) ─────────────────────────────────────
// 5×7 dot patterns for digits + colon. Each character is an SVG grid so the
// clock reads as a real instrument-panel display regardless of font loading.
const DIGIT_DOTS: Record<string, string[]> = {
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','11110','00001','00001','10001','01110'],
  '6': ['00110','01000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00010','01100'],
  ':': ['00000','00000','00100','00000','00000','00100','00000'],
}

function DotChar({ ch, cell, gap }: { ch: string; cell: number; gap: number }) {
  const pat = DIGIT_DOTS[ch] || DIGIT_DOTS['0']
  const cols = 5, rows = 7
  const w = cols * (cell + gap) - gap
  const h = rows * (cell + gap) - gap
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {pat.map((row, y) => row.split('').map((v, x) => (
        <circle
          key={`${x}-${y}`}
          cx={x * (cell + gap) + cell / 2}
          cy={y * (cell + gap) + cell / 2}
          r={cell / 2}
          fill={v === '1' ? '#000' : '#DADADA'}
        />
      )))}
    </svg>
  )
}

export function DotClock({ cell = 9, gap = 3 }: { cell?: number; gap?: number }) {
  const [now, setNow] = useState(new Date())
  // Tick every second so the clock feels alive.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const hh = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, userSelect: 'none' }}>
      <div style={{ width: 12, height: 12, borderRadius: 999, background: T.orange, flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: cell + 2 }}>
        {hh.split('').map((c, i) => <DotChar key={i} ch={c} cell={cell} gap={gap} />)}
      </div>
    </div>
  )
}
