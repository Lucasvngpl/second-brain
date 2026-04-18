import { useState, type KeyboardEvent } from "react"

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

type Props = {
  onSearch: (query: string) => void
  loading: boolean
  voiceState: VoiceState   // controls mic button appearance
  onMicClick: () => void   // parent handles all recording logic
}

export default function SearchBar({ onSearch, loading, voiceState, onMicClick }: Props) {
  const [query, setQuery] = useState("")

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") onSearch(query)
  }

  // Mic icon changes per voice state
  const micIcon = (() => {
    if (voiceState === 'processing') {
      // Spinner replaces mic during processing
      return (
        <div className="w-3.5 h-3.5 border border-[#2E2B26] border-t-[#E8590C] rounded-full animate-spin" />
      )
    }

    const color = voiceState === 'speaking' ? '#C8BEA8' : '#E8590C'
    const opacity = voiceState === 'idle' ? 0.5 : 1

    return (
      <svg className="w-3 h-3" viewBox="0 0 12 16" fill="none" style={{ opacity }}>
        <rect x="3" y="0" width="6" height="9" rx="3" fill={color}/>
        <path d="M1 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="6" y1="13" x2="6" y2="15.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  })()

  // Mic button border pulses orange while listening
  const micButtonStyle: React.CSSProperties = {
    background: "rgba(232,89,12,0.08)",
    border: voiceState === 'listening'
      ? "0.5px solid rgba(232,89,12,0.6)"
      : "0.5px solid rgba(232,89,12,0.2)",
    animation: voiceState === 'listening' ? 'micPulse 1.5s ease-in-out infinite' : 'none',
  }

  return (
    <div className="px-5 pt-4 pb-3">
      <div
        className="flex items-center gap-3 rounded-md transition-all"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          padding: "11px 14px",
        }}
      >
        {/* Search icon */}
        <svg className="w-3 h-3 flex-shrink-0" style={{ color: '#4A463F' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask your second brain anything..."
          className="flex-1 bg-transparent text-[13px] outline-none placeholder-[#7A7060] text-[#C8BEA8]"
          style={{ caretColor: '#E8590C' }}
          autoFocus
        />

        {/* Text search spinner — only shown when loading from a typed query */}
        {loading && voiceState === 'idle' && (
          <div className="w-3.5 h-3.5 border border-[#2E2B26] border-t-[#7A7060] rounded-full animate-spin flex-shrink-0" />
        )}

        {/* Mic button — second click during listening cancels recording */}
        <button
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:bg-white/[0.05]"
          style={micButtonStyle}
          onClick={onMicClick}
          aria-label={voiceState === 'listening' ? 'Cancel recording' : 'Start voice search'}
        >
          {micIcon}
        </button>
      </div>
    </div>
  )
}
