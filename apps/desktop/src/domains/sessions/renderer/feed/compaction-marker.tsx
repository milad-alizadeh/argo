import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatElapsed } from '@/domains/sessions/renderer/feed/elapsed'
import { Loader } from '@/platform/renderer/components/loader'
import { Progress } from '@/platform/renderer/components/ui/progress'

function elapsedSince(startedAt: string, now: number) {
  return formatElapsed(now - Date.parse(startedAt))
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
  const { t } = useTranslation('sessions')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <article className="grid gap-2 type-body" role="status">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Loader aria-hidden={true} />
        <span>{t('marks.compacting')}</span>
        <span aria-hidden="true" className="text-muted-foreground tabular-nums">
          ({elapsedSince(startedAt, now)}
          {tokens === null ? '' : ` · ↓ ${tokens}`})
        </span>
      </div>
      {percentage === null ? null : (
        <div className="flex items-center gap-2 pl-6">
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
