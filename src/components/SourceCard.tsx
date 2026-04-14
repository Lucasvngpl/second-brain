import type { Source } from "../App"
import { useState } from "react"

// Color dot per source type
const sourceColors: Record<string, string> = {
  notion: "#7F77DD",
  gmail: "#5DCAA5",
  photos: "#EF9F27",
  audio: "#D4537E",
  default: "#888780",
}

type Props = { source: Source }

export default function SourceCard({ source }: Props) {
  const [expanded, setExpanded] = useState(false)
  const color = sourceColors[source.source] ?? sourceColors.default
  

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="bg-white/[0.06] backdrop-blur-xl border border-white/[0.10] rounded-xl px-4 py-3 cursor-pointer hover:bg-white/[0.10] transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Color dot indicates source type */}
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-white/65 truncate">{source.title}</p>
          <p className="text-[11px] text-white/20 mt-0.5">{source.source}</p>
        </div>
        <span className="text-[10px] text-white/20 flex-shrink-0">
          {(source.similarity * 100).toFixed(0)}% match
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <p className="text-[12px] text-white/50 leading-relaxed">{source.content}</p>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              onClick={e => e.stopPropagation()}
              className="inline-block mt-2 text-[11px] text-white/30 hover:text-white/50"
            >
              Open in {source.source} ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}