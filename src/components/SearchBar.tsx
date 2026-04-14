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
    <div className="px-5 pt-4 pb-3 border-b border-[#2E2B26]">
      <div
        className="flex items-center gap-3 rounded-md transition-all"
        style={{
          background: "rgba(240,234,220,0.03)",
          border: "0.5px solid #3A3630",
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
          className="flex-1 bg-transparent text-[13px] outline-none placeholder-[#4A463F] text-[#C8BEA8]"
          style={{ caretColor: '#E8590C' }}
          autoFocus
        />

        {loading && (
          <div className="w-3.5 h-3.5 border border-[#2E2B26] border-t-[#7A7060] rounded-full animate-spin flex-shrink-0" />
        )}

        {/* Mic button — orange accent, circle stays round */}
        <button
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:bg-white/[0.05]"
          style={{ background: "rgba(232,89,12,0.08)", border: "0.5px solid rgba(232,89,12,0.2)" }}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 16" fill="none">
            <rect x="3" y="0" width="6" height="9" rx="3" fill="#E8590C"/>
            <path d="M1 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="#E8590C" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="6" y1="13" x2="6" y2="15.5" stroke="#E8590C" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
