import { T } from "./ui"

type Props = {
  history: string[]
  onSelect: (query: string) => void
}

// Recent-query column shown to the right of answers. First item is the most
// recent — rendered slightly bolder so the latest query reads as "current".
export default function RecentPanel({ history, onSelect }: Props) {
  if (history.length === 0) return null

  return (
    <div style={{ width: 170, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: T.mute,
        margin: '0 0 6px',
        fontWeight: 400,
      }}>recent</p>
      {history.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: '7px 10px',
            borderRadius: 6,
            fontFamily: "'Inter', sans-serif",
            fontWeight: i === 0 ? 500 : 400,
            fontSize: 12,
            lineHeight: 1.4,
            color: i === 0 ? T.text : T.text3,
            transition: 'background 200ms',
          }}
        >
          {q}
        </button>
      ))}
    </div>
  )
}
