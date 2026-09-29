import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppPageHeader } from '@/platform/renderer/app/components/app-shell'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { PageHeading } from '@/platform/renderer/components/page-heading'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'
import { providerPresentation } from '@/providers/presentation-registry'
import { type Backlog, backlogRows, unfoldedRows } from '../lib/backlog'
import type { TicketProblemProps } from '../lib/problems'
import { TicketVirtualList } from './ticket-virtual-list'

export type TicketListProps = {
  backlog: Backlog
  selectedKey: string | null
  onSelect: (key: string) => void
  // The moment a Ticket's age is measured against, so a caller controls whether it moves.
  now: number
  placement?: 'workspace' | 'sidebar'
}

function tally(
  t: TFunction<'tickets'>,
  { tickets, query, total, hasMore, searching, provider }: Backlog,
): string {
  if (searching) return t('backlog.searching', { provider: providerPresentation(provider).name })
  if (query !== '') return t('backlog.match', { count: total ?? tickets.length })
  return hasMore
    ? t('backlog.allOpenMore', { count: tickets.length })
    : t('backlog.allOpen', { count: tickets.length })
}

function NoTickets({ query, provider }: Pick<Backlog, 'query' | 'provider'>) {
  const { t } = useTranslation('tickets')
  const { name, scope } = providerPresentation(provider)
  return (
    <Empty className="flex-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {query === '' ? <Icon name="ticket" /> : <Icon name="no-search-results" />}
        </EmptyMedia>
        <EmptyTitle>
          {query === '' ? t('backlog.empty.title') : t('backlog.empty.titleFiltered')}
        </EmptyTitle>
        <EmptyDescription>
          {query === ''
            ? t('backlog.empty.description', { scope: scope.one })
            : t('backlog.empty.descriptionFiltered', { provider: name, query })}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

// A failed scan keeps the saved rows on screen, so its failure sits above them rather than over them.
function SyncProblem({ icon, title, description, alert, actions }: TicketProblemProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-(--spacing-shell-item) border-b border-border/60 px-(--spacing-shell-inset) py-(--spacing-shell-item)"
      role={alert ? 'alert' : undefined}
    >
      <span className="text-danger">
        <Icon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-body">{title}</p>
        <p className="type-meta text-muted-foreground">{description}</p>
      </div>
      {actions.map((action) => (
        <Button
          key={action.label}
          onClick={action.onClick}
          size="sm"
          variant={action.primary ? 'default' : 'ghost'}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}

// A folded parent hides the rows under it until it is unfolded; every parent starts unfolded.
function useFolds() {
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const toggle = (key: string) =>
    setFolded((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  return { folded, toggle }
}

export function TicketList({
  backlog,
  selectedKey,
  onSelect,
  now,
  placement = 'workspace',
}: TicketListProps) {
  const { t } = useTranslation('tickets')
  const { folded, toggle } = useFolds()
  const rows = unfoldedRows(backlogRows(backlog.tickets), folded)
  return (
    <section aria-label={t('backlog.label')} className="flex h-full min-h-0 min-w-0 flex-col">
      {placement === 'workspace' ? (
        <AppPageHeader>
          <PageHeading>{t('backlog.label')}</PageHeading>
          <div className="ml-auto flex items-center gap-(--spacing-shell-item)">
            {backlog.sync.refreshing ? (
              <p className="type-meta text-faint">
                {t('backlog.refreshing', { provider: providerPresentation(backlog.provider).name })}
              </p>
            ) : null}
            <p aria-live="polite" className="type-meta text-muted-foreground">
              {tally(t, backlog)}
            </p>
          </div>
        </AppPageHeader>
      ) : null}
      {backlog.sync.problem ? <SyncProblem {...backlog.sync.problem} /> : null}
      {backlog.tickets.length === 0 ? (
        <NoTickets provider={backlog.provider} query={backlog.query} />
      ) : null}
      {backlog.tickets.length > 0 ? (
        <TicketVirtualList
          backlog={backlog}
          folded={folded}
          now={now}
          onSelect={onSelect}
          onToggle={toggle}
          placement={placement}
          rows={rows}
          selectedKey={selectedKey}
        />
      ) : null}
    </section>
  )
}
