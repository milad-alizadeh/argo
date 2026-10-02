import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/platform/renderer/components/design-system/empty-state'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
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
    <EmptyState
      className={compact ? 'mx-auto mt-(--spacing-snug) max-w-sm' : 'h-full'}
      data-state="stalled"
      description={t(
        posture === 'live' ? 'stalled.description.live' : 'stalled.description.external',
      )}
      media={<Icon name="retry" />}
      size={compact ? 'compact' : 'full'}
      title={t('stalled.title')}
      actionClassName="flex-row justify-center"
      action={
        <Button onClick={onRetry} type="button" variant="outline">
          {t('stalled.retry')}
        </Button>
      }
    />
  )
}
