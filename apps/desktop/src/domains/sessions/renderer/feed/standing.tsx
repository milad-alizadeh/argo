import { useTranslation } from 'react-i18next'
import { FeedLoading } from '@/domains/sessions/renderer/feed/feed-loading'
import { StalledFeed } from '@/domains/sessions/renderer/feed/stalled-feed'
import { sessionFailureState } from '@/domains/sessions/renderer/session-failure-state'
import type { SessionError } from '@/domains/sessions/renderer/types'
import { Icon } from '@/platform/renderer/components/icon'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'

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
  posture: 'managed' | 'external' | null
  onRetry: () => void
}) {
  const { t } = useTranslation('sessions')
  if (failure !== null)
    return (
      <section
        className="grid h-full place-items-center p-6"
        data-state={sessionFailureState(failure.code)}
      >
        <Alert className="max-w-sm" variant="destructive">
          <Icon name="triangle-alert" />
          <AlertTitle>{t('standing.failure')}</AlertTitle>
          <AlertDescription>{failure.message}</AlertDescription>
        </Alert>
      </section>
    )
  if (!selected)
    return (
      <Empty className="h-full" data-state="unselected">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="messages-square" />
          </EmptyMedia>
          <EmptyTitle>{t('standing.unselectedTitle')}</EmptyTitle>
          <EmptyDescription>{t('standing.unselectedDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  if (stalled) return <StalledFeed posture={posture} onRetry={onRetry} />
  return <FeedLoading state="loading" />
}
