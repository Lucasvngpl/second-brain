import { T } from "./ui"

type Props = {
  backendOnline: boolean
  count: number
  // Source name of the most recently indexed memory (e.g. "notion") or null
  // when stats haven't loaded yet — falls back to an em-dash in that case.
  lastSyncedSource: string | null
}

// Bottom-of-window readout: live backend/memory/version strip in monospace.
export default function StatusBar({ backendOnline, count, lastSyncedSource }: Props) {
  return (
    <div style={{
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      height: 28,
      borderTop: `1px solid ${T.border}`,
      background: T.card,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      fontWeight: 400,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: backendOnline ? T.green : T.mute,
          display: 'inline-block',
        }} />
        <span style={{ color: T.text3 }}>{backendOnline ? 'backend connected' : 'backend offline'}</span>
        <span style={{ color: T.mute2 }}>·</span>
        <span style={{ color: T.text3 }}>{count} memories</span>
        <span style={{ color: T.mute2 }}>·</span>
        <span style={{ color: T.text3 }}>last synced · {lastSyncedSource ?? '—'}</span>
      </div>
      <span style={{ color: T.mute }}>v0.1.4</span>
    </div>
  )
}
