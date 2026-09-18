import { Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../../platform/renderer/components/ui/empty'

export function TicketDetailEmpty() {
  const { t } = useTranslation('tickets')
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Ticket aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('detail.empty.title')}</EmptyTitle>
        <EmptyDescription>{t('detail.empty.description')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
