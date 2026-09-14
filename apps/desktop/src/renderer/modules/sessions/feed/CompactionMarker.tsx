import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Progress } from '../../../components/ui/progress'

function elapsedSince(startedAt: string, now: number) {
  const elapsed = Math.max(0, now - Date.parse(startedAt))
  const minutes = Math.floor(elapsed / 60_000)
  const seconds = Math.floor((elapsed % 60_000) / 1_000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function CompactionMarker({
  percentage,
  startedAt,
  tokens,
}: {
  percentage: number | null
  startedAt: string
  tokens: string | null
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <article className="feed-row feed-row--marker grid gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        <span role="status">Compacting conversation…</span>
        <span aria-hidden="true" className="text-muted-foreground tabular-nums">
          ({elapsedSince(startedAt, now)}
          {tokens === null ? '' : ` · ↓ ${tokens}`})
        </span>
      </div>
      {percentage === null ? null : (
        <div aria-hidden="true" className="flex items-center gap-2 pl-6">
          <Progress
            className="min-w-0 flex-1 [&_[data-slot=progress-track]]:h-2"
            value={percentage}
          />
          <span className="shrink-0 text-muted-foreground tabular-nums">{percentage}%</span>
        </div>
      )}
    </article>
  )
}
