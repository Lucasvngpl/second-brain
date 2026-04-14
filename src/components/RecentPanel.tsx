type Props = {
  history: string[]
  onSelect: (query: string) => void
}

export default function RecentPanel({ history, onSelect }: Props) {
  if (history.length === 0) return (
    <div className="w-[180px] flex-shrink-0" />
  )

  return (
    <div className="w-[180px] flex-shrink-0 flex flex-col gap-1.5">
      <p className="text-[10px] tracking-widest uppercase text-white/15 mb-1">Recent</p>
      {history.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          className={`text-left px-3 py-2.5 rounded-lg border text-[12px] leading-snug transition-colors
            ${i === 0
              ? "bg-white/[0.05] border-white/10 text-white/50"
              : "bg-white/[0.02] border-white/[0.06] text-white/25 hover:bg-white/[0.04]"
            }`}
        >
          {q}
        </button>
      ))}
    </div>
  )
}