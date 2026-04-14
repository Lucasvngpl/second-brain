import { useState, type KeyboardEvent } from "react"

type Props = {
  onSearch: (query: string) => void
  loading: boolean
}

export default function SearchBar({ onSearch, loading }: Props) {
  const [query, setQuery] = useState("")

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") onSearch(query)
  }

  return (
    <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
      <div className="flex items-center gap-3 bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] rounded-xl px-4 py-3">
        {/* Search icon */}
        <svg className="w-4 h-4 text-white/25 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask your second brain anything..."
          className="flex-1 bg-transparent text-[14px] text-white/85 placeholder-white/20 outline-none"
          autoFocus
        />

        {/* Loading indicator */}
        {loading && (
          <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin flex-shrink-0" />
        )}

        {/* Mic button — placeholder for voice later */}
        <button className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0 hover:bg-white/10 transition-colors">
          <svg className="w-3 h-3" viewBox="0 0 12 16" fill="none">
            <rect x="3" y="0" width="6" height="9" rx="3" fill="rgba(255,255,255,0.3)"/>
            <path d="M1 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="6" y1="13" x2="6" y2="15.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Keyboard shortcut hint */}
        <span className="text-[11px] text-white/15 bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.08] flex-shrink-0">⌘K</span>
      </div>
    </div>
  )
}