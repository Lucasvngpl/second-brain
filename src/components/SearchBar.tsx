import { useState, type KeyboardEvent } from "react"
import { T } from "./ui"

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

type Props = {
  onSearch: (query: string) => void
  voiceState: VoiceState   // controls mic button icon
  onMicClick: () => void   // parent handles all recording logic
}

export default function SearchBar({ onSearch, voiceState, onMicClick }: Props) {
  const [query, setQuery] = useState("")

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") onSearch(query)
  }

  return (
    <div style={{ padding: '14px 20px 10px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: '11px 14px',
      }}>
        {/* Search glass icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="ask your second brain anything..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
            fontSize: 14,
            color: T.text,
            caretColor: T.orange,
          }}
          autoFocus
        />

        {/* Solid orange mic button — morphs into a spinner during processing */}
        <button
          onClick={onMicClick}
          aria-label={voiceState === 'listening' ? 'Cancel recording' : 'Start voice search'}
          style={{
            all: 'unset',
            width: 30,
            height: 30,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: T.orange,
            transition: 'opacity 200ms',
          }}
        >
          {voiceState === 'processing' ? (
            <div style={{
              width: 13,
              height: 13,
              border: '1.5px solid rgba(255,255,255,0.4)',
              borderTopColor: '#fff',
              borderRadius: 999,
              animation: 'jvl-spin 800ms linear infinite',
            }} />
          ) : (
            <svg width="11" height="14" viewBox="0 0 12 16" fill="none">
              <rect x="3" y="0" width="6" height="9" rx="3" fill="#fff" />
              <path d="M1 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="6" y1="13" x2="6" y2="15.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
