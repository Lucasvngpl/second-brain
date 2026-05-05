import { useEffect, useState } from 'react'

// Shape returned by GET /stats — see search.py
export type Stats = {
  total: number
  by_source: Record<string, number>
  latest: { source: string; title: string; created_at: string } | null
}

// Fetch /stats once on mount and then every 15s. The `online` arg lets the
// hook re-fire after the backend recovers (App.tsx flips backendOnline back
// to true on the next successful /search), so the dashboard catches up
// without waiting for the next interval tick.
export function useStats(online: boolean): Stats | null {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let cancelled = false

    async function tick() {
      try {
        const res = await fetch('http://localhost:8000/stats')
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as Stats
        if (!cancelled) setStats(data)
      } catch {
        if (!cancelled) setStats(null)
      }
    }

    tick()
    const id = setInterval(tick, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [online])

  return stats
}

// Compact "5m ago" / "2h ago" / "yesterday" / "may 02" readout for the
// LATEST tile. Falls back to an em-dash if the timestamp is unparseable.
export function relativeTime(iso: string | undefined | null): string {
  if (!iso) return '—'
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return '—'

  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 86400 * 2) return 'yesterday'

  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toLowerCase()
}
