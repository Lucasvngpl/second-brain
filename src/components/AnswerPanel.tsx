import type { SearchResult } from "../App"
import SourceCard from "./SourceCard.tsx"
import { marked } from "marked"

type Props = {
  result: SearchResult | null
  loading: boolean
}

export default function AnswerPanel({ result, loading }: Props) {
  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-white/20 text-sm">Thinking...</p>
    </div>
  )

  if (!result) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-white/10 text-sm">Ask anything about your second brain</p>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-w-0">
      {/* Synthesized answer */}
      <div className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] rounded-2xl p-5">
        <p className="text-[10px] tracking-widest uppercase text-white/20 mb-3">Jarvis</p>
        <div 
            className="text-[13px] text-white/70 leading-relaxed prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: marked(result.answer) as string }}
        />
      </div>

      {/* Source cards */}
      {result.sources.map((source, i) => (
        <SourceCard key={i} source={source} />
      ))}
    </div>
  )
}