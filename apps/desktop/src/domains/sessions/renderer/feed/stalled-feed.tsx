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

// Past a stall bound (feed-stall.ts), the reader sees this instead of an indefinite spinner.
// Retry re-runs whatever produced the stall rather than reloading the app (#2102).
export function StalledFeed({
  posture,
  onRetry,
  compact = false,
}: {
  posture: SessionPosture | null
  onRetry: () => void
  compact?: boolean
}) {
  const { t } = useTranslation('sessions')
  return (
    <Empty
      className={compact ? 'mx-auto mt-(--spacing-snug) max-w-sm' : 'h-full'}
      data-state="stalled"
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="retry" />
        </EmptyMedia>
        <EmptyTitle>{t('stalled.title')}</EmptyTitle>
        <EmptyDescription>
          {t(posture === 'live' ? 'stalled.description.live' : 'stalled.description.external')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={onRetry} type="button" variant="outline">
          {t('stalled.retry')}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
