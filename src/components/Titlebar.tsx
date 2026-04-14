import React from 'react'

export default function Titlebar() {
  return (
    <div
      className="h-9 flex items-center px-5 border-b border-[#2E2B26] flex-shrink-0"
      style={{ background: '#161412', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 70px spacer — macOS traffic lights occupy this area (positioned by Electron) */}
      <div className="w-[70px]" />

      {/* JARVIS wordmark — centered */}
      <span
        className="flex-1 text-center text-[10px] tracking-[0.2em] uppercase text-[#4A463F]"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Jarvis
      </span>

      {/* ⌘K hint — far right, opt out of drag so it's clickable */}
      <div
        className="w-[70px] flex justify-end"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span
          className="text-[9px] text-[#2E2B26] px-1.5 py-0.5 rounded"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            background: 'rgba(255,255,255,0.02)',
            border: '0.5px solid #2E2B26',
          }}
        >
          ⌘K
        </span>
      </div>
    </div>
  )
}
