import { useTranslation } from 'react-i18next'
import { AppPageSurface } from '@/platform/renderer/app/components/app-shell'
import { EmptyState } from '@/platform/renderer/components/design-system/empty-state'
import { Icon } from '@/platform/renderer/components/icon/icon'

export function TicketDetailEmpty() {
  const { t } = useTranslation('tickets')
  return (
    <AppPageSurface>
      <EmptyState
        className="min-h-0"
        description={t('detail.empty.description')}
        media={<Icon name="ticket" />}
        title={t('detail.empty.title')}
      />
    </AppPageSurface>
  )
}

// A Ticket opened by reference while neither SQLite nor the provider has answered.
export function TicketDetailReading({ reference }: { reference: string }) {
  const { t } = useTranslation('tickets')
  return (
    <div className="flex h-full min-h-0 flex-col" role="status">
      <EmptyState
        className="min-h-0"
        media={<Icon name="ticket" />}
        title={t('loading.ticket', { reference })}
      />
    </div>
  )
}
