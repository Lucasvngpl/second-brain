import { useState, useEffect } from "react"
import type { SearchResult } from "../App"
import SourceCard from "./SourceCard"
import PhotoResults from "./PhotoResults"
import { T, Tile, BlockBar, DotClock } from "./ui"

type Props = {
  result: SearchResult | null
  loading: boolean
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

// Empty-state dashboard: 3×2 grid of instrument tiles. Values are placeholders
// reproducing the kit — wiring real ingest metrics is a follow-up.
function EmptyState() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

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
          36<span style={{ fontSize: 13, color: T.text3, fontWeight: 400, marginLeft: 4 }}>indexed</span>
        </div>
        <div style={{
          marginTop: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: T.mute,
          letterSpacing: '0.14em',
          fontWeight: 400,
        }}>/ 50,000 cap</div>
        <div style={{ marginTop: 14 }}>
          <BlockBar value={0.72} color={T.block} total={22} blockW={6} height={8} />
        </div>
      </Tile>

      {/* Now embedding — orange dot indicates active */}
      <Tile label="embedding" orangeDot>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 14, color: T.text, lineHeight: 1.3 }}>
          alps planning — day 2
        </div>
        <div style={{
          marginTop: 4,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: T.text3,
          letterSpacing: '0.12em',
          fontWeight: 400,
        }}>NOTION · PAGE 14 / 36</div>
        <div style={{ marginTop: 14 }}>
          <BlockBar value={0.38} color={T.orange} total={22} blockW={6} height={8} />
        </div>
      </Tile>

      {/* Sources breakdown */}
      <Tile label="sources">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { label: 'notion', count: 36,  color: T.notion,  fill: 1.0 },
            { label: 'photos', count: 184, color: '#8A7A5B', fill: 0.72 },
            { label: 'gmail',  count: 0,   color: '#8A5B5B', fill: 0.0 },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: r.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: T.text, flex: 1 }}>{r.label}</span>
              <BlockBar value={r.fill} color={r.color} total={12} blockW={5} height={6} />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: T.text3,
                width: 26,
                textAlign: 'right',
                fontWeight: 400,
              }}>{r.count}</span>
            </div>
          ))}
        </div>
      </Tile>

      {/* System status */}
      <Tile label="status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StatusRow dot={T.green}  label="backend"    value="connected" />
          <StatusRow dot={T.green}  label="embeddings" value="in sync" />
          <StatusRow dot={T.orange} label="indexing"   value="page 14/36" />
          <StatusRow dot={T.mute}   label="voice"      value="idle" />
        </div>
      </Tile>
    </div>
  )
}

export default function AnswerPanel({ result, loading }: Props) {
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

  if (!result) return <EmptyState />

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
