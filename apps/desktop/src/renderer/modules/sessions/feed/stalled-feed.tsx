import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'

// Past a stall bound (feed-stall.ts), the reader sees this instead of an indefinite spinner.
// Retry re-runs whatever produced the stall rather than reloading the app (#2102).
export function StalledFeed({
  posture,
  onRetry,
}: {
  posture: 'managed' | 'external' | null
  onRetry: () => void
}) {
  const { t } = useTranslation('sessions')
  return (
    <Empty className="h-full border-0" data-state="stalled">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RotateCw aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('stalled.title')}</EmptyTitle>
        <EmptyDescription>
          {t(
            posture === 'external' ? 'stalled.description.external' : 'stalled.description.managed',
          )}
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
