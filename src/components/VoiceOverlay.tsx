import { useEffect, useRef, useState } from "react"

type VoiceState = 'listening' | 'processing' | 'speaking'

type Props = {
  state: VoiceState
  transcript: string       // shown during processing and speaking
  analyser: AnalyserNode | null  // Web Audio analyser from mic — null when speaking
  onCancel: () => void     // click anywhere to cancel
}

// ─── Waveform ───────────────────────────────────────────────────────────────
// 28 bars that animate based on analyser data or random when no analyser.
// Used in all three states with different color and animation settings.

type WaveformProps = {
  color: string
  animated: boolean
  analyser: AnalyserNode | null
  interval?: number          // ms between animation frames
  frozenHeights?: number[]   // used in processing state to hold last captured heights
}

function Waveform({ color, animated, analyser, interval = 120, frozenHeights }: WaveformProps) {
  const BAR_COUNT = 28
  const [heights, setHeights] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => Math.random() * 20 + 4)
  )

  useEffect(() => {
    // Frozen state — use provided heights and don't animate
    if (!animated) {
      if (frozenHeights) setHeights(frozenHeights)
      return
    }

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    const id = setInterval(() => {
      if (analyser && dataArray) {
        // Read real mic frequency data and map to bar heights
        analyser.getByteFrequencyData(dataArray)
        const step = Math.floor(dataArray.length / BAR_COUNT)
        setHeights(Array.from({ length: BAR_COUNT }, (_, i) => {
          const val = dataArray[i * step] / 255  // 0–1
          return Math.max(4, val * 36)           // clamp to 4–36px
        }))
      } else {
        // No analyser (speaking state) — use smooth random animation
        setHeights(prev => prev.map(h => {
          const delta = (Math.random() - 0.5) * 12
          return Math.max(4, Math.min(36, h + delta))
        }))
      }
    }, interval)

    return () => clearInterval(id)
  }, [animated, analyser, interval, frozenHeights])

  return (
    <div className="flex items-end justify-center gap-[3px]" style={{ height: 40 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: h,
            background: color,
            borderRadius: 1.5,
            transition: animated ? `height ${interval * 0.8}ms ease` : 'none',
          }}
        />
      ))}
    </div>
  )
}

// ─── Recording Timer ─────────────────────────────────────────────────────────
// Counts up from 0 while in listening state.

function RecordingTimer() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <span
      className="absolute bottom-4 left-5 text-[9px] tracking-widest"
      style={{ fontFamily: "'JetBrains Mono', monospace", color: '#4A463F' }}
    >
      {mm}:{ss}
    </span>
  )
}

// ─── VoiceOverlay ────────────────────────────────────────────────────────────

export default function VoiceOverlay({ state, transcript, analyser, onCancel }: Props) {
  // Capture waveform heights when transitioning from listening → processing
  // so bars freeze at their last real position
  const frozenHeightsRef = useRef<number[]>([])
  const [frozenHeights, setFrozenHeights] = useState<number[]>([])

  useEffect(() => {
    if (state === 'processing' && frozenHeightsRef.current.length > 0) {
      setFrozenHeights([...frozenHeightsRef.current])
    }
  }, [state])

  // Volume scale for the orb — driven by analyser in listening state
  const [orbScale, setOrbScale] = useState(1)
  const orbAnimRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state !== 'listening' || !analyser) {
      setOrbScale(1)
      if (orbAnimRef.current) clearInterval(orbAnimRef.current)
      return
    }
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    orbAnimRef.current = setInterval(() => {
      analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      // Subtle scale — avg is 0–255, we want ~1.0–1.08 range max
      frozenHeightsRef.current = Array.from({ length: 28 }, (_, i) => {
        const step = Math.floor(dataArray.length / 28)
        const val = dataArray[i * step] / 255
        return Math.max(4, val * 36)
      })
      setOrbScale(1 + avg / 800)
    }, 80)
    return () => { if (orbAnimRef.current) clearInterval(orbAnimRef.current) }
  }, [state, analyser])

  // Orb style per state
  const orbStyle: React.CSSProperties = state === 'speaking'
    ? { border: '1px solid rgba(200,190,168,0.3)', background: 'rgba(200,190,168,0.03)' }
    : state === 'processing'
    ? { border: '1px solid rgba(232,89,12,0.3)', background: 'rgba(232,89,12,0.02)' }
    : { border: '1px solid rgba(232,89,12,0.4)', background: 'rgba(232,89,12,0.03)' }

  const waveColor = state === 'speaking' ? '#C8BEA8' : '#E8590C'
  const waveInterval = state === 'speaking' ? 180 : 120

  const label = state === 'listening' ? 'LISTENING'
    : state === 'processing' ? 'PROCESSING'
    : 'JARVIS'

  const labelColor = state === 'speaking' ? '#C8BEA8'
    : state === 'processing' ? '#4A463F'
    : '#E8590C'

  return (
    // Full content-area overlay — click anywhere to cancel
    <div
      className="flex-1 flex flex-col items-center justify-center relative select-none cursor-pointer"
      onClick={onCancel}
      style={{ opacity: 1, transition: 'opacity 200ms' }}
    >

      {/* ── Orb ─────────────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center mb-6" style={{ width: 88, height: 88 }}>

        {/* Processing arc — orbits the outside of the orb like a radar sweep */}
        {state === 'processing' && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(#E8590C 0deg, #E8590C 90deg, transparent 90deg)',
              animation: 'orbSweep 1.5s linear infinite',
              // Mask out the inside so only the outer ring shows as an arc
              WebkitMask: 'radial-gradient(circle at center, transparent 39px, black 40px, black 44px, transparent 45px)',
              mask: 'radial-gradient(circle at center, transparent 39px, black 40px, black 44px, transparent 45px)',
            }}
          />
        )}

        {/* The orb itself */}
        <div
          className="rounded-full"
          style={{
            width: 80,
            height: 80,
            ...orbStyle,
            transform: state === 'listening' ? `scale(${orbScale})` : 'scale(1)',
            transition: 'transform 80ms ease, border-color 200ms, background 200ms',
          }}
        />
      </div>

      {/* ── Waveform ─────────────────────────────────────────────────────── */}
      {state === 'processing' ? (
        // Frozen bars at last captured heights, heavily faded
        <div style={{ opacity: 0.2 }}>
          <Waveform
            color={waveColor}
            animated={false}
            analyser={null}
            frozenHeights={frozenHeights}
          />
        </div>
      ) : (
        <Waveform
          color={waveColor}
          animated={true}
          analyser={state === 'listening' ? analyser : null}
          interval={waveInterval}
        />
      )}

      {/* ── Label ────────────────────────────────────────────────────────── */}
      <p
        className="mt-4 text-[9px] tracking-widest uppercase"
        style={{ fontFamily: "'JetBrains Mono', monospace", color: labelColor }}
      >
        {label}
      </p>

      {/* ── Sub-label / transcript ───────────────────────────────────────── */}
      {state === 'listening' && (
        <p
          className="mt-1 text-[9px] tracking-widest"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: '#4A463F' }}
        >
          silence detection active
        </p>
      )}

      {(state === 'processing' || state === 'speaking') && transcript && (
        <p
          className="mt-2 text-center italic"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            color: state === 'speaking' ? '#C8BEA8' : '#7A7060',
            maxWidth: 280,
            lineHeight: 1.5,
            animation: 'fadeIn 300ms ease',
          }}
        >
          {state === 'speaking' ? transcript.slice(0, 80) : transcript}
        </p>
      )}

      {/* ── Recording timer (listening only, bottom-left) ─────────────────── */}
      {state === 'listening' && <RecordingTimer />}

    </div>
  )
}
