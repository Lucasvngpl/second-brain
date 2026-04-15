type Props = {
  backendOnline: boolean
}

export default function StatusBar({ backendOnline }: Props) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-between px-4 h-7 border-t border-[#2E2B26]"
      style={{ background: 'rgba(0,0,0,0.1)', fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* Left: live system readouts separated by · */}
      <div className="flex items-center gap-3 text-[9px] tracking-widest uppercase">
        <span style={{ color: backendOnline ? '#4A463F' : '#8A5B5B' }}>
          {backendOnline ? 'Backend Connected' : 'Backend Offline'}
        </span>
        <span className="text-[#2E2B26]">·</span>
        <span className="text-[#4A463F]">36 Memories</span>
        <span className="text-[#2E2B26]">·</span>
        <span className="text-[#4A463F]">Last Synced · Notion</span>
      </div>

      {/* Right: version stamp — barely visible */}
      <span className="text-[9px] text-[#2E2B26] tracking-widest uppercase">v0.1.0</span>
    </div>
  )
}
