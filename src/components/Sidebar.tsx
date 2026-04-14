const sources = [
  { id: "all", label: "All", count: "36" },
  { id: "notion", label: "Notion", count: "36" },
  { id: "gmail", label: "Gmail", count: null },
  { id: "photos", label: "Photos", count: null },
  { id: "audio", label: "Audio", count: null },
]

type Props = {
  activeSource: string
  onSourceChange: (id: string) => void
}

export default function Sidebar({ activeSource, onSourceChange }: Props) {
  return (
    <div className="w-[220px] flex-shrink-0 bg-white/[0.05] backdrop-blur-xl border-r border-white/[0.08] flex flex-col py-4">
      {/* Title bar dots */}
      <div className="flex items-center gap-2 px-5 mb-6">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-auto text-[11px] tracking-widest uppercase text-white/20">Jarvis</span>
      </div>

      {/* Source filters */}
      <div className="px-3">
        <p className="text-[10px] tracking-widest uppercase text-white/20 px-2 mb-2">Sources</p>
        {sources.map(s => (
          <button
            key={s.id}
            onClick={() => s.count && onSourceChange(s.id)}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg mb-0.5 transition-colors text-left
              ${activeSource === s.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}
              ${!s.count ? "opacity-40 cursor-default" : "cursor-pointer"}`}
          >
            {/* Source icon dot */}
            <div className="w-4 h-4 rounded flex-shrink-0 bg-white/[0.06] border border-white/10" />
            <span className={`text-[13px] ${activeSource === s.id ? "text-white/85" : "text-white/45"}`}>
              {s.label}
            </span>
            <span className="ml-auto text-[11px] text-white/20">
              {s.count ?? "soon"}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}