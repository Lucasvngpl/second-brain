import { useState } from "react"
import Sidebar from "./components/Sidebar"
import SearchBar from "./components/SearchBar.tsx"
import AnswerPanel from "./components/AnswerPanel.tsx"
import RecentPanel from "./components/RecentPanel.tsx"

// Shape of a single source result from the backend
export type Source = {
  title: string
  content: string
  source: string
  url: string
  similarity: number
}

// Shape of the full search response
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

    // Add query to recent history
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
    <div className="flex h-screen w-screen bg-[#0a0a0a] overflow-hidden relative">
      {/* Ambient color blobs — give backdrop-blur something to render */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-900/15 rounded-full blur-3xl pointer-events-none" />

      {/* Left sidebar — source filters */}
      <Sidebar activeSource={activeSource} onSourceChange={setActiveSource} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Search bar at top */}
        <SearchBar onSearch={handleSearch} loading={loading} />

        {/* Results area */}
        <div className="flex flex-1 gap-5 p-6 overflow-hidden">
          <AnswerPanel result={result} loading={loading} />
          <RecentPanel history={history} onSelect={handleSearch} />
        </div>
      </div>
    </div>
  )
}