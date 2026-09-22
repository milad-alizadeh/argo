import { useTranslation } from 'react-i18next'

import { Icon } from '@/platform/renderer/components/icon'
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
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="ticket" />
        </EmptyMedia>
        <EmptyTitle>{t('detail.empty.title')}</EmptyTitle>
        <EmptyDescription>{t('detail.empty.description')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
