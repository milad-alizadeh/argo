import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/platform/renderer/components/design-system/empty-state'
import { Notice } from '@/platform/renderer/components/design-system/notice'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { sessionFailureState } from '../session-failure-state'
import type { SessionError, SessionPosture } from '../types'
import { FeedLoading } from './feed-loading'
import { StalledFeed } from './stalled-feed'

export function Standing({
  failure,
  selected,
  stalled,
  posture,
  onRetry,
}: {
  failure: SessionError | null
  selected: boolean
  stalled: boolean
  posture: SessionPosture | null
  onRetry: () => void
}) {
  const { t } = useTranslation('sessions')
  if (failure?.code === 'missing-session')
    return (
      <section className="grid h-full place-items-center p-6" data-state="unavailable">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <h2 className="type-title text-foreground">{t('standing.missingHistoryTitle')}</h2>
          <p className="type-body text-muted-foreground">
            {t('standing.missingHistoryDescription')}
          </p>
          <Button className="mt-2" onClick={onRetry} type="button" variant="outline">
            {t('standing.retry')}
          </Button>
        </div>
      </section>
    )
  if (failure !== null)
    return (
      <section
        className="grid h-full place-items-center p-6"
        data-state={sessionFailureState(failure.code)}
      >
        <Notice
          className="max-w-sm"
          heading={t('standing.failure')}
          icon="triangle-alert"
          tone="danger"
        >
          {failure.message}
          <Button onClick={onRetry} type="button" variant="outline">
            {t('standing.retry')}
          </Button>
        </Notice>
      </section>
    )
  if (!selected)
    return (
      <EmptyState
        data-state="unselected"
        description={t('standing.unselectedDescription')}
        media={<Icon name="messages-square" />}
        title={t('standing.unselectedTitle')}
      />
    )
  if (stalled) return <StalledFeed posture={posture} onRetry={onRetry} />
  return <FeedLoading state="loading" />
}
