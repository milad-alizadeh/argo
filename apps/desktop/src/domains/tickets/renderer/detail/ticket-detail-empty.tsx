import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'

export function TicketDetailEmpty() {
  const { t } = useTranslation('tickets')
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Empty className="min-h-0 flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="ticket" />
          </EmptyMedia>
          <EmptyTitle>{t('detail.empty.title')}</EmptyTitle>
          <EmptyDescription>{t('detail.empty.description')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}

// A Ticket opened by reference while neither SQLite nor the provider has answered.
export function TicketDetailReading({ reference }: { reference: string }) {
  const { t } = useTranslation('tickets')
  return (
    <div className="flex h-full min-h-0 flex-col" role="status">
      <Empty className="min-h-0 flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="ticket" />
          </EmptyMedia>
          <EmptyTitle>{t('loading.ticket', { reference })}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
