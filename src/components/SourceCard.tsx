import type { Source } from "../App"
import { useState } from "react"

const sourceColors: Record<string, string> = {
  notion: "#5B7B8A",  // RAL 5024 pastoral blue
  gmail:  "#8A5B5B",  // RAL 3020 muted red
  photos: "#8A7A5B",  // RAL 1001 muted amber
  audio:  "#5B6E8A",  // RAL 5003 sapphire blue
  default:"#4A463F",
}

type Props = { source: Source }

export default function SourceCard({ source }: Props) {
  const [expanded, setExpanded] = useState(false)
  const color = sourceColors[source.source] ?? sourceColors.default

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="rounded-md px-4 py-3 cursor-pointer transition-all"
      style={{
        background: expanded ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
        border: "0.5px solid #2A2722",
      }}
      onMouseEnter={e => {
        if (!expanded) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)"
      }}
      onMouseLeave={e => {
        if (!expanded) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          {/* Title — Inter 12px secondary */}
          <p className="text-[12px] text-[#7A7060] truncate">{source.title}</p>
          {/* Source badge — JetBrains Mono 9px uppercase */}
          <p
            className="text-[9px] text-[#4A463F] mt-0.5 uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {source.source}
          </p>
        </div>
        {/* Similarity % — JetBrains Mono 10px, very muted */}
        <span
          className="text-[10px] text-[#2E2B26] flex-shrink-0"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {(source.similarity * 100).toFixed(0)}%
        </span>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#2A2722]">
          <p className="text-[11px] text-[#7A7060] leading-relaxed">{source.content}</p>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              onClick={e => e.stopPropagation()}
              className="inline-block mt-2 text-[10px] text-[#4A463F] hover:text-[#7A7060] transition-colors"
            >
              Open in {source.source} ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}
