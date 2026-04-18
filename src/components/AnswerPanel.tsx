import { useState, useEffect } from "react"
import type { SearchResult } from "../App"
import SourceCard from "./SourceCard.tsx"
import { marked } from "marked"

type Props = {
  result: SearchResult | null
  loading: boolean
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return "good morning, Lucas"
  if (hour >= 12 && hour < 17) return "good afternoon, Lucas"
  if (hour >= 17 && hour < 22) return "good evening, Lucas"
  return "good night, Lucas"
}

function EmptyState() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const hh = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    /* Full height of the content area — paddingBottom compensates for the search bar + status bar
       above/below so the clock lands visually centered in the window */
    <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ paddingBottom: 80, paddingRight: 40 }}>
      {/* Dot-grid card housing the clock — Nothing OS physical display aesthetic */}
      <div
        className="relative flex flex-col items-center justify-center gap-2 px-10 py-8 rounded-md"
        style={{
          backgroundImage: 'radial-gradient(circle, #2E2B26 0.8px, transparent 0.8px)',
          backgroundSize: '8px 8px',
        }}
      >
        {/* Doto: variable dot-matrix font — reads like a physical LED panel */}
        <p
          className="leading-none select-none"
          style={{
            fontFamily: '"Doto", monospace',
            fontSize: 80,
            color: '#C8BEA8',
            letterSpacing: '-0.02em',
            fontWeight: 400,
          }}
        >
          {hh}
        </p>
      </div>
      <p
        className="text-[14px] select-none"
        style={{ color: '#7A7060', letterSpacing: '0.12em', marginTop: '8px' }}
      >
        {getGreeting()}
      </p>
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
        style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)" }}
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
