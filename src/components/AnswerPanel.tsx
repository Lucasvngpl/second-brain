import { useState, useEffect } from "react"
import type { SearchResult, VoiceState } from "../App"
import SourceCard from "./SourceCard"
import PhotoResults from "./PhotoResults"
import { T, Tile, BlockBar, DotClock, SOURCES } from "./ui"
import type { Stats } from "../lib/stats"

type Props = {
  result: SearchResult | null
  loading: boolean
  // Live readouts driving every tile in the empty state. Null while the
  // first /stats response hasn't landed yet — tiles fall back to em-dashes.
  stats: Stats | null
  backendOnline: boolean
  voiceState: VoiceState
  // Fires a real search — used by the SUGGESTED tile so a tap is identical
  // to typing the prompt into the search bar.
  onPromptSelect: (prompt: string) => void
}

// Strip the lightweight markdown Claude tends to emit so the plain-text
// renderer doesn't show ** or <strong> tags literally.
function stripMarkdown(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/<strong[^>]*>(.*?)<\/strong>/g, '$1')
}

// One row of the status tile — colored status dot + label + uppercase value.
function StatusRow({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: 999, background: dot, flexShrink: 0 }} />
      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: T.text, flex: 1 }}>{label}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        color: T.text3,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 400,
      }}>{value}</span>
    </div>
  )
}

// Memory cap shown beneath the total — purely a visual ceiling for the
// progress bar, not enforced server-side. Easy to bump later.
const MEMORY_CAP = 50_000

// Sources we render rows for in the SOURCES tile. Mirrors the sidebar order
// minus the synthetic 'all' entry so the two surfaces feel like one readout.
const TILE_SOURCE_ORDER = ['notion', 'apple_notes', 'photos', 'gmail', 'audio'] as const

// Curated demo prompts. Each one was chosen to either (a) span sources or
// (b) show off semantic-not-literal recall. We pick three at random per app
// load — stable across re-renders thanks to useState's initializer — so a
// demo run feels fresh without the values jumping around mid-session.
const PROMPT_POOL = [
  'best days of my life',
  'advice I have written for myself',
  'moments I felt focused',
  'what did I learn about embeddings',
  'things I want to build',
  'photos from Vietnam',
  'what makes a good product',
] as const

function pickPrompts(): string[] {
  const pool = [...PROMPT_POOL]
  const out: string[] = []
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

type EmptyStateProps = {
  stats: Stats | null
  backendOnline: boolean
  voiceState: VoiceState
  onPromptSelect: (prompt: string) => void
}

// Empty-state dashboard: 3×2 grid of instrument tiles, every value driven by
// the live /stats payload + the parent's connectivity/voice flags.
function EmptyState({ stats, backendOnline, voiceState, onPromptSelect }: EmptyStateProps) {
  // Three curated demo prompts, picked once on mount.
  const [prompts] = useState(pickPrompts)
  // Day/date readout in the hero tile — ticks once a second so a midnight
  // rollover updates the label without a refresh.
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

  // Build the per-source rows. Bar fill is normalized against the largest
  // source so the visual stays meaningful regardless of total scale.
  const bySource = stats?.by_source ?? {}
  const maxCount = Math.max(1, ...Object.values(bySource))
  const sourceColor = Object.fromEntries(SOURCES.map(s => [s.id, s.color])) as Record<string, string>

  const total = stats?.total ?? 0

  // Voice row — orange when something is happening, mute when idle.
  const voiceActive = voiceState !== 'idle'

  return (
    <div style={{
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '1.5fr 1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: 12,
      minHeight: 0,
      minWidth: 0,
    }}>
      {/* Hero clock tile — spans both rows on the left */}
      <Tile label="local time" dotGrid pad={20} style={{ gridRow: 'span 2', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <DotClock cell={9} gap={3} />
        </div>
        <div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 22, color: T.text }}>{dayName}</div>
          <div style={{
            marginTop: 4,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: T.text3,
            letterSpacing: '0.18em',
            fontWeight: 400,
          }}>{dateStr}</div>
        </div>
      </Tile>

      {/* Memories indexed */}
      <Tile label="memories">
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 32, color: T.text, lineHeight: 1 }}>
          {total}<span style={{ fontSize: 13, color: T.text3, fontWeight: 400, marginLeft: 4 }}>indexed</span>
        </div>
        <div style={{
          marginTop: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: T.mute,
          letterSpacing: '0.14em',
          fontWeight: 400,
        }}>/ {MEMORY_CAP.toLocaleString()} cap</div>
        <div style={{ marginTop: 14 }}>
          <BlockBar value={Math.min(total / MEMORY_CAP, 1)} color={T.block} total={22} blockW={6} height={8} />
        </div>
      </Tile>

      {/* Suggested prompts — tapping fires a real search. Doubles as a demo
          launchpad and an empty-state nudge for new users. */}
      <Tile label="suggested">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {prompts.map(p => (
            <button
              key={p}
              onClick={() => onPromptSelect(p)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 6px',
                borderRadius: 6,
                transition: 'background 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: T.mute,
                letterSpacing: '0.12em',
              }}>↗</span>
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 400,
                fontSize: 13,
                color: T.text,
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>{p}</span>
            </button>
          ))}
        </div>
      </Tile>

      {/* Sources breakdown — driven by the live by_source map */}
      <Tile label="sources">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {TILE_SOURCE_ORDER.map(id => {
            const count = bySource[id] ?? 0
            const color = sourceColor[id] ?? T.text3
            const fill = count / maxCount
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0, opacity: count === 0 ? 0.4 : 1 }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: T.text, flex: 1 }}>{id}</span>
                <BlockBar value={fill} color={color} total={12} blockW={5} height={6} />
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: T.text3,
                  width: 26,
                  textAlign: 'right',
                  fontWeight: 400,
                }}>{count}</span>
              </div>
            )
          })}
        </div>
      </Tile>

      {/* System status — every row reads a real flag */}
      <Tile label="status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StatusRow
            dot={backendOnline ? T.green : T.mute}
            label="backend"
            value={backendOnline ? 'connected' : 'offline'}
          />
          <StatusRow
            dot={stats ? T.green : T.mute}
            label="embeddings"
            value={stats ? 'in sync' : 'offline'}
          />
          <StatusRow
            dot={T.mute}
            label="memories"
            value={`${total} indexed`}
          />
          <StatusRow
            dot={voiceActive ? T.orange : T.mute}
            label="voice"
            value={voiceState}
          />
        </div>
      </Tile>
    </div>
  )
}

export default function AnswerPanel({ result, loading, stats, backendOnline, voiceState, onPromptSelect }: Props) {
  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
      <div style={{
        width: 18,
        height: 18,
        border: `1.5px solid ${T.border}`,
        borderTopColor: T.orange,
        borderRadius: 999,
        animation: 'jvl-spin 800ms linear infinite',
      }} />
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        color: T.text3,
        margin: 0,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight: 400,
      }}>thinking</p>
    </div>
  )

  if (!result) return <EmptyState stats={stats} backendOnline={backendOnline} voiceState={voiceState} onPromptSelect={onPromptSelect} />

  // Split photo sources from everything else so we can render the kit's
  // photo grid for images and keep the SourceCard list for text-based hits.
  const photoSources = result.sources.filter(s => s.source === 'photos')
  const otherSources = result.sources.filter(s => s.source !== 'photos')

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      overflowY: 'auto',
      minWidth: 0,
      paddingRight: 4,
    }}>
      {/* Synthesized answer card */}
      <div style={{
        padding: '16px 18px',
        borderRadius: 10,
        background: T.card,
        border: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: 999, background: T.orange }} />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: T.text3,
            fontWeight: 400,
          }}>answer</span>
        </div>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 400,
          fontSize: 14,
          color: T.text,
          lineHeight: 1.6,
        }}>{stripMarkdown(result.answer)}</div>
      </div>

      {/* Photo grid — only when results include photos */}
      {photoSources.length > 0 && <PhotoResults sources={photoSources} />}

      {/* Non-photo sources keep the existing card list */}
      {otherSources.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 2px 0' }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: T.text3,
              fontWeight: 400,
            }}>sources</span>
            <span style={{ color: T.mute2 }}>·</span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: T.mute,
              fontWeight: 400,
            }}>{otherSources.length} matched</span>
          </div>

          {otherSources.map((source, i) => (
            <SourceCard key={i} source={source} />
          ))}
        </>
      )}
    </div>
  )
}
