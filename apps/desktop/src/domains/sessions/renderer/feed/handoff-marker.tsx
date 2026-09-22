import { Loader } from '@/platform/renderer/components/loader'

export function HandoffMarker() {
  const { t } = useTranslation('sessions')
  return (
    <article className="feed-row feed-row--marker grid gap-2 type-body" role="status">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Loader aria-hidden={true} />
        <span>{t('handoff.inProgress')}</span>
      </div>
    </article>
  )
}

export function HandoffCompletedMarker({
  sessionId,
  onOpenSession,
}: {
  sessionId: string
  onOpenSession: (sessionId: string) => void
}) {
  const { t } = useTranslation('sessions')
  return (
    <article className="feed-row feed-row--marker grid gap-2 type-body">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{t('handoff.complete')}</span>
        <button
          className="text-foreground underline underline-offset-2"
          onClick={() => onOpenSession(sessionId)}
          type="button"
        >
          {t('handoff.open')}
        </button>
      </div>
    </article>
  )
}

import { useTranslation } from 'react-i18next'
