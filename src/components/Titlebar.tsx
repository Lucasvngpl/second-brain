import type { CSSProperties } from 'react'
import { T } from './ui'

// Top window chrome. Electron paints the real macOS traffic lights at
// { x: 18, y: 18 } (see app/main.js), so we just leave a 70px non-drag
// spacer on the left so those clicks still land. The rest of the bar is
// drag-enabled so the user can move the window by it.
export default function Titlebar() {
  return (
    <div style={{
      height: 42,
      flexShrink: 0,
      background: T.card,
      borderBottom: `1px solid ${T.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      WebkitAppRegion: 'drag',
    } as CSSProperties}>
      {/* Reserved area for the native traffic lights */}
      <div
        style={{ position: 'absolute', top: 0, left: 0, width: 70, height: '100%', WebkitAppRegion: 'no-drag' } as CSSProperties}
      />

      {/* JARVIS wordmark — monospace, heavily letter-spaced, muted */}
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: '0.22em',
        color: T.text3,
        fontWeight: 400,
      }}>Second Brain</span>
    </div>
  )
}
