import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'
import type { SessionPosture } from '../types'

// A live reply stall follows a loaded history; an external Session keeps its read text (#3170).
const stalledCopy = {
  history: { title: 'stalled.title', description: 'stalled.description.live' },
  reply: { title: 'stalled.reply.title', description: 'stalled.reply.description' },
  external: { title: 'stalled.title', description: 'stalled.description.external' },
} as const

// Past a stall bound (feed-stall.ts), the reader sees this instead of an indefinite spinner.
// Retry re-runs whatever produced the stall rather than reloading the app (#2102).
export function StalledFeed({
  posture,
  waitingFor,
  onRetry,
}: {
  posture: SessionPosture | null
  waitingFor: 'history' | 'reply'
  onRetry: () => void
}) {
  const { t } = useTranslation('sessions')
  const copy = stalledCopy[posture === 'live' ? waitingFor : 'external']
  return (
    <Empty
      className={waitingFor === 'reply' ? 'mx-auto mt-(--spacing-snug) max-w-sm' : 'h-full'}
      data-state="stalled"
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="retry" />
        </EmptyMedia>
        <EmptyTitle>{t(copy.title)}</EmptyTitle>
        <EmptyDescription>{t(copy.description)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={onRetry} type="button" variant="outline">
          {t('stalled.retry')}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
