import { MessageSquareDashedIcon, MousePointerClickIcon, PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'

// What the Feed shows when there is no history to draw: no Session is selected, or the one that
// is holds nothing yet. Both are shadcn's Empty, centred in the Feed pane.
export function FeedEmpty({ reason }: { reason: 'unselected' | 'blank' | 'no-sessions' }) {
  const { t } = useTranslation()
  return (
    <Empty
      className="feed__standing h-full"
      data-component={reason === 'no-sessions' ? 'SessionsEmptyState' : 'FeedEmpty'}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {reason === 'unselected' ? <MousePointerClickIcon /> : <MessageSquareDashedIcon />}
        </EmptyMedia>
        <EmptyTitle>{t(`empty.${reason}.title`)}</EmptyTitle>
        <EmptyDescription>{t(`empty.${reason}.description`)}</EmptyDescription>
      </EmptyHeader>
      {reason === 'no-sessions' ? (
        <button className="session-page__primary-button" type="button">
          <PlusIcon aria-hidden="true" />
          {t('newSession')}
        </button>
      ) : null}
    </Empty>
  )
}
