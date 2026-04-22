import type { Source } from "../App"
import { T, BlockBar } from "./ui"

// Per-source accent colors — fallback to `text2` if the backend returns
// a source type we haven't mapped yet.
const SOURCE_COLORS: Record<string, string> = {
  notion: T.notion,
  gmail:  '#8A5B5B',
  photos: '#8A7A5B',
  audio:  '#5B6E8A',
}

export default function SourceCard({ source }: { source: Source }) {
  const color = SOURCE_COLORS[source.source] ?? T.text2
  // Fall back to the raw similarity if the backend doesn't ship a `fill` hint,
  // so the block bar still visually reflects how well the source matched.
  const fill = (source as { fill?: number }).fill ?? source.similarity

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 8,
      background: T.card,
      border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            fontSize: 13,
            color: T.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{source.title}</div>
          <div style={{ marginTop: 8 }}>
            <BlockBar value={fill} color={color} total={24} blockW={6} height={6} />
          </div>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: T.text3,
          fontWeight: 400,
          letterSpacing: '0.14em',
          flexShrink: 0,
        }}>
          {source.source.toUpperCase()} · {Math.round(source.similarity * 100)}%
        </span>
      </div>
    </div>
  )
}
