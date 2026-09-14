import { Plus, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type ConnectionSummary, TICKET_QUERY_LIMIT } from '@/core/tickets/contract'
import { Button } from '../../../components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../../../components/ui/input-group'
import { sourcePresentation } from '../lib/sources'
import { useTicketSearch } from '../state/useTicketSearch'

// The provider answers the search, so the field only holds the words; the backlog reads the settled query.
function TicketSearchField() {
  const { t } = useTranslation('tickets')
  const { query, setOpen, setQuery } = useTicketSearch()
  return (
    <div className="shrink-0 border-b border-border/60 p-(--spacing-shell-item)">
      <InputGroup>
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={t('sidebarHeader.search')}
          // The field opens because the person asked to type in it.
          autoFocus
          maxLength={TICKET_QUERY_LIMIT}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
          }}
          placeholder={t('sidebarHeader.searchPlaceholder')}
          value={query}
        />
        {query === '' ? null : (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={t('sidebarHeader.clearSearch')}
              onClick={() => setQuery('')}
              size="icon-xs"
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  )
}

// A new Ticket is written on the provider's own page until Argo can write one (#1850, #1851).
function NewTicket({ connection }: { connection: ConnectionSummary | null }) {
  const { t } = useTranslation('tickets')
  const page = connection && sourcePresentation(connection.provider).newTicketURL
  if (!connection) {
    return (
      <Button aria-label={t('sidebarHeader.newTicket')} disabled size="icon-sm" variant="ghost">
        <Plus />
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
      <Plus />
    </Button>
  )
}

export function TicketsSidebarHeader({ connection }: { connection: ConnectionSummary | null }) {
  const { t } = useTranslation('tickets')
  const { open, setOpen } = useTicketSearch()
  const scope = connection?.scope ?? null
  return (
    <>
      <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-(--spacing-shell-inset)">
        <h2 className="type-heading flex-1">{t('sidebarHeader.title')}</h2>
        <div className="flex items-center gap-(--spacing-shell-tight)">
          <NewTicket connection={connection} />
          <Button
            aria-label={t('sidebarHeader.findTicket')}
            aria-pressed={open}
            disabled={scope === null}
            onClick={() => setOpen(!open)}
            size="icon-sm"
            variant="ghost"
          >
            <Search />
          </Button>
        </div>
      </header>
      {open && scope !== null ? <TicketSearchField /> : null}
    </>
  )
}
