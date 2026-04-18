type Props = {
  history: string[]
  onSelect: (query: string) => void
}

export default function RecentPanel({ history, onSelect }: Props) {
  if (history.length === 0) return null

  return (
    <div className="w-[160px] flex-shrink-0 flex flex-col gap-1">
      {/* RECENT label — Inter 10px, very muted */}
      <p className="text-[10px] tracking-widest uppercase text-[#2E2B26] mb-1">Recent</p>
      {history.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          className="text-left px-3 py-2 rounded-md text-[12px] leading-snug transition-all hover:bg-white/[0.04]"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "0.5px solid #2E2B26",
            color: i === 0 ? "#4A463F" : "#2E2B26",
          }}
        >
          {q}
        </button>
      ))}
    </div>
  )
}
