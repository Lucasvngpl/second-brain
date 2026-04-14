import { useState } from "react"
import Sidebar from "./components/Sidebar"
import SearchBar from "./components/SearchBar.tsx"
import AnswerPanel from "./components/AnswerPanel.tsx"
import RecentPanel from "./components/RecentPanel.tsx"

export type Source = {
  title: string
  content: string
  source: string
  url: string
  similarity: number
}

export type SearchResult = {
  answer: string
  sources: Source[]
}

export default function App() {
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [activeSource, setActiveSource] = useState("all")

  async function handleSearch(query: string) {
    if (!query.trim()) return
    setLoading(true)
    setHistory(prev => [query, ...prev.slice(0, 9)])

    try {
      const res = await fetch("http://localhost:8000/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query })
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ answer: "Could not reach the backend. Is it running?", sources: [] })
    }

    setLoading(false)
  }

  return (
    /* Full-screen canvas — bg-transparent lets Electron vibrancy show through */
    <div className="h-screen w-screen overflow-hidden relative bg-transparent">

      {/* Subtle neutral vignette blobs — give backdrop-blur something to catch */}
      <div className="absolute inset-0 opacity-40"
        style={{ background: "radial-gradient(ellipse at 30% 60%, #6b7585 0%, transparent 65%)" }} />
      <div className="absolute inset-0 opacity-25"
        style={{ background: "radial-gradient(ellipse at 75% 30%, #8090a0 0%, transparent 60%)" }} />

      {/* THE ONE BIG GLASS CARD — edge-to-edge, macOS handles rounding via roundedCorners */}
      <div className="glass-card absolute inset-0 flex overflow-hidden border-0 shadow-[0_8px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)]">

        {/* Sidebar — drag region at top clears macOS traffic lights */}
        <Sidebar activeSource={activeSource} onSourceChange={setActiveSource} />

        <div className="flex flex-col flex-1 min-w-0">
          <SearchBar onSearch={handleSearch} loading={loading} />

          <div className="flex flex-1 gap-4 p-5 overflow-hidden">
            <AnswerPanel result={result} loading={loading} />
            <RecentPanel history={history} onSelect={handleSearch} />
          </div>
        </div>
      </div>
    </div>
  )
}
