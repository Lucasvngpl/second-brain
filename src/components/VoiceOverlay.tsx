import { useEffect, useRef, useState } from "react"
import { T } from "./ui"

type VoiceState = 'listening' | 'processing' | 'speaking'

type Props = {
  state: VoiceState
  transcript: string               // shown during processing + speaking
  analyser: AnalyserNode | null    // Web Audio analyser — null while speaking
  onCancel: () => void             // click anywhere to cancel
}

const BAR_COUNT = 32

// ─── Waveform ────────────────────────────────────────────────────────────────
// 32 bars that either follow real mic frequency data (when we have an
// analyser) or animate with smooth randomness (while speaking). When frozen
// (processing), we hold the last captured heights so the bars feel paused.
type WaveformProps = {
  color: string
  animated: boolean
  analyser: AnalyserNode | null
  interval?: number
  frozenHeights?: number[]
}

function Waveform({ color, animated, analyser, interval = 120, frozenHeights }: WaveformProps) {
  const [heights, setHeights] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 4 + Math.random() * 40)
  )

  useEffect(() => {
    if (!animated) {
      if (frozenHeights) setHeights(frozenHeights)
      return
    }

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    const id = setInterval(() => {
      if (analyser && dataArray) {
        // Real mic data drives bar heights during the listening state.
        analyser.getByteFrequencyData(dataArray)
        const step = Math.floor(dataArray.length / BAR_COUNT)
        setHeights(Array.from({ length: BAR_COUNT }, (_, i) => {
          const val = dataArray[i * step] / 255
          return Math.max(4, val * 44)
        }))
      } else {
        // No analyser (speaking state) — walk each bar by a small delta.
        setHeights(prev => prev.map(v => {
          const d = (Math.random() - 0.5) * 14
          return Math.max(4, Math.min(44, v + d))
        }))
      }
    }, interval)

    return () => clearInterval(id)
  }, [animated, analyser, interval, frozenHeights])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 48 }}>
      {heights.map((v, i) => (
        <div key={i} style={{
          width: 3,
          height: v,
          background: color,
          borderRadius: 1.5,
          transition: animated ? `height ${interval * 0.8}ms ease` : 'none',
        }} />
      ))}
    </div>
  )
}

// ─── Recording timer (bottom-left while listening) ──────────────────────────
function RecordingTimer() {
  const [s, setS] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setS(x => x + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return (
    <span style={{
      position: 'absolute',
      bottom: 16,
      left: 20,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10,
      letterSpacing: '0.22em',
      color: T.mute,
      fontWeight: 400,
    }}>{mm}:{ss}</span>
  )
}

// ─── VoiceOverlay ────────────────────────────────────────────────────────────
export default function VoiceOverlay({ state, transcript, analyser, onCancel }: Props) {
  // Capture waveform heights as we transition listening → processing so the
  // bars appear "paused" at the last real reading rather than snapping away.
  const frozenHeightsRef = useRef<number[]>([])
  const [frozenHeights, setFrozenHeights] = useState<number[]>([])

  useEffect(() => {
    if (state === 'processing' && frozenHeightsRef.current.length > 0) {
      setFrozenHeights([...frozenHeightsRef.current])
    }
  }, [state])

  // Orb pulse scale — driven by average mic volume while listening.
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
      // Also cache bar heights so we can freeze them on transition.
      const step = Math.floor(dataArray.length / BAR_COUNT)
      frozenHeightsRef.current = Array.from({ length: BAR_COUNT }, (_, i) => {
        const val = dataArray[i * step] / 255
        return Math.max(4, val * 44)
      })
      setOrbScale(1 + avg / 800)
    }, 80)
    return () => { if (orbAnimRef.current) clearInterval(orbAnimRef.current) }
  }, [state, analyser])

  // Orb border color: orange for listening/processing, black for speaking.
  const orbBorder = state === 'speaking' ? `2px solid ${T.text}` : `2px solid ${T.orange}`
  const waveColor = state === 'speaking' ? T.text : T.orange
  const waveInt = state === 'speaking' ? 180 : 120

  const label = state === 'listening' ? 'listening' : state === 'processing' ? 'processing' : 'jarvis'
  const labelColor = state === 'speaking' ? T.text : state === 'processing' ? T.text3 : T.orange

  return (
    <div
      onClick={onCancel}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: 'pointer',
        userSelect: 'none',
        background: T.bg,
      }}
    >
      {/* Orb + optional processing sweep */}
      <div style={{
        position: 'relative',
        width: 96,
        height: 96,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 26,
      }}>
        {state === 'processing' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: `conic-gradient(${T.orange} 0deg, ${T.orange} 90deg, transparent 90deg)`,
            animation: 'jvl-sweep 1.5s linear infinite',
            // Mask out everything except a thin ring on the orb's outer edge
            WebkitMask: 'radial-gradient(circle at center, transparent 42px, black 43px, black 47px, transparent 48px)',
            mask: 'radial-gradient(circle at center, transparent 42px, black 43px, black 47px, transparent 48px)',
          }} />
        )}
        <div style={{
          width: 88,
          height: 88,
          borderRadius: 999,
          border: orbBorder,
          background: 'transparent',
          transform: state === 'listening' ? `scale(${orbScale})` : 'scale(1)',
          transition: 'transform 80ms ease, border-color 200ms, background 200ms',
        }} />
      </div>

      {/* Waveform — frozen + faded during processing, else animated */}
      {state === 'processing' ? (
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
          interval={waveInt}
        />
      )}

      {/* State label */}
      <p style={{
        marginTop: 20,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        color: labelColor,
        fontWeight: 400,
      }}>{label}</p>

      {state === 'listening' && (
        <p style={{
          marginTop: 4,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: '0.2em',
          color: T.mute,
          fontWeight: 400,
        }}>silence detection active</p>
      )}

      {(state === 'processing' || state === 'speaking') && transcript && (
        <p style={{
          marginTop: 12,
          fontFamily: "'Inter', sans-serif",
          fontWeight: state === 'speaking' ? 500 : 400,
          fontSize: 13,
          color: state === 'speaking' ? T.text : T.text3,
          maxWidth: 320,
          lineHeight: 1.55,
          textAlign: 'center',
        }}>{transcript}</p>
      )}

      {state === 'listening' && <RecordingTimer />}
    </div>
  )
}
