import { useTranslation } from 'react-i18next'
import { type ConnectionSummary, TICKET_QUERY_LIMIT } from '@/domains/tickets/contract/contract'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { SidebarSearch } from '@/platform/renderer/components/sidebar-search'
import { Button } from '@/platform/renderer/components/ui/button'
import { providerPresentation } from '@/providers/presentation-registry'
import { useTicketSearch } from '../state/use-ticket-search'

// A new Ticket is written on the provider's own page until Argo can write one (#1850, #1851).
function NewTicket({ connection }: { connection: ConnectionSummary | null }) {
  const { t } = useTranslation('tickets')
  const page = connection && providerPresentation(connection.provider).newTicketURL
  if (!connection) {
    return (
      <Button aria-label={t('sidebarHeader.newTicket')} disabled size="icon-sm" variant="ghost">
        <Icon name="add" />
      </Button>
    )
  }
  if (!page) return null
  return (
    <Button
      aria-label={t('sidebarHeader.newTicket')}
      nativeButton={false}
      render={<a href={page(connection.scope)} rel="noreferrer" target="_blank" />}
      size="icon-sm"
      variant="ghost"
    >
      <Icon name="add" />
    </Button>
  )
}

// The provider answers the search, so the field only holds the words; the backlog reads the settled query.
export function TicketsSidebarHeader({ connection }: { connection: ConnectionSummary | null }) {
  const { t } = useTranslation('tickets')
  const { query, setQuery } = useTicketSearch()
  return (
    <header className="flex h-(--size-chrome-bar) sidebar-gutter shrink-0 items-center">
      <SidebarSearch
        label={t('sidebarHeader.search')}
        maxLength={TICKET_QUERY_LIMIT}
        onChange={setQuery}
        placeholder={t('sidebarHeader.searchPlaceholder')}
        value={query}
      />
      <div className="ml-(--spacing-shell-tight) flex items-center">
        <NewTicket connection={connection} />
      </div>
    </header>
  )
}
