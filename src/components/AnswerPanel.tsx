import { useState, useEffect } from "react"
import type { SearchResult } from "../App"
import SourceCard from "./SourceCard.tsx"
import { marked } from "marked"

type Props = {
  result: SearchResult | null
  loading: boolean
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'good morning, Lucas'
  if (h < 17) return 'good afternoon, Lucas'
  return 'good evening, Lucas'
}

function EmptyState() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const hh = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2">
      {/* Large quiet clock — JetBrains Mono, very muted */}
      <p
        className="text-[48px] text-[#2E2B26] leading-none select-none"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {hh}
      </p>
      <p className="text-[12px] text-[#4A463F] select-none">{getGreeting()}</p>
    </div>
  )
}

export default function AnswerPanel({ result, loading }: Props) {
  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border border-[#2E2B26] border-t-[#7A7060] rounded-full animate-spin" />
        <p className="text-[12px] text-[#4A463F]">Thinking...</p>
      </div>
    </div>
  )

  if (!result) return <EmptyState />

  return (
    <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto min-w-0 pr-1">
      {/* Synthesized answer */}
      <div
        className="rounded-md p-4"
        style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid #2E2B26" }}
      >
        {/* — JARVIS — label */}
        <p
          className="text-[9px] tracking-widest uppercase text-[#4A463F] mb-2.5"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          — Jarvis —
        </p>
        {/* Answer text — Inter 13px, generous line-height */}
        <div
          className="text-[13px] text-[#C8BEA8] prose prose-invert prose-sm max-w-none"
          style={{ lineHeight: '1.65' }}
          dangerouslySetInnerHTML={{ __html: marked(result.answer) as string }}
        />
      </div>

      {result.sources.map((source, i) => (
        <SourceCard key={i} source={source} />
      ))}
    </div>
  )
}
