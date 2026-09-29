// The view-derivation helpers `useTicketsView` composes: each reads one loading/error/ready shape
// out of its inputs, kept out of the hook file to stay under the per-file line cap.
import type { UseQueryResult } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { AccountListing } from '@/domains/accounts/renderer'
import type { ProjectSummary } from '@/domains/projects/renderer'
import type {
  ConnectionSummary,
  TicketError,
  TicketPriority,
  TicketStatus,
} from '@/domains/tickets/contract/contract'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import { providerPresentation } from '@/providers/presentation-registry'
import type { ConnectSourceFormProps } from '../connection/connect-source-form'
import type { TicketDeckProps } from '../detail/ticket-deck'
import {
  connectionProblem,
  failureProblem,
  isConnectionProblem,
  type Recovery,
  type TicketProblemProps,
} from '../lib/problems'
import { listedBacklog, type TicketListing } from './listed-backlog'
import { savedRead } from './use-active-tickets'
import type { ConnectForm } from './use-connect-form'
import type { TicketDetailRead } from './use-ticket-detail'
import type { TicketPages } from './use-tickets'

// Everything the Tickets screen can show, resolved here before anything draws.
export type TicketsView =
  | { kind: 'no-project' }
  | { kind: 'loading'; label: string }
  | ({ kind: 'problem' } & TicketProblemProps)
  | ({ kind: 'unconnected'; projectId: string } & ConnectSourceFormProps)
  | ({ kind: 'tickets'; projectId: string } & TicketDeckProps)

export const loading = (label: string): TicketsView => ({ kind: 'loading', label })

type Retry = {
  onRetry: () => unknown
  onReconnect: () => void
  provider: Provider | null
}

export const failure = (
  title: string,
  error: ContractFailure,
  { onRetry, onReconnect, provider }: Retry,
): TicketsView => ({
  kind: 'problem',
  ...failureProblem(title, error, {
    onRetry: () => void onRetry(),
    onReconnect,
    provider,
  }),
})

export type Unconnected = {
  project: ProjectSummary
  accounts: UseQueryResult<AccountListing, ContractFailure>
  form: ConnectForm
  onReconnect: () => void
}

export function unconnectedView(
  t: TFunction<'tickets'>,
  { project, accounts, form, onReconnect }: Unconnected,
): TicketsView {
  if (accounts.isPending) return loading(t('loading.accounts'))
  if (accounts.error) {
    return failure(t('failure.accounts'), accounts.error, {
      onRetry: accounts.refetch,
      onReconnect,
      provider: null,
    })
  }
  return {
    kind: 'unconnected',
    projectId: project.id,
    projectName: project.name,
    accounts: accounts.data.accounts,
    ...form,
  }
}

export type Connected = {
  projectId: string
  connection: ConnectionSummary
  list: TicketListing
  query: string
  onDisconnectSource: () => void
  onChangeStatus: (key: string, status: TicketStatus) => void
  onChangePriority: (key: string, priority: TicketPriority | null) => void
  selectedKey: string | null
  // The selected Ticket as SQLite saved it, and its by-ID provider read.
  detail: TicketDetailRead
  now: number
  onBack: () => void
  onSelect: (key: string) => void
  onOpenSession: (id: string) => void
  onReconnect: () => void
  // Asks main to scan the provider, or to search it while a query is set, again.
  onSync: () => void
}

// A failed search leaves the saved matches, a failed scan the saved list.
function refreshProblem(
  t: TFunction<'tickets'>,
  { failed, query, recovery }: { failed: TicketError | null; query: string; recovery: Recovery },
  provider: Provider,
) {
  if (failed === null) return null
  const title =
    query === ''
      ? t('failure.refresh')
      : t('failure.search', { provider: providerPresentation(provider).name })
  return failureProblem(title, failed, recovery)
}

function detailProblem(t: TFunction<'tickets'>, detail: TicketDetailRead, recovery: Recovery) {
  if (!detail.failure) return null
  const title = t(detail.ticket ? 'failure.ticketRefresh' : 'failure.ticket')
  return failureProblem(title, detail.failure, recovery)
}

const hasSavedRows = (pages: TicketPages | undefined) => (savedRead(pages)?.total ?? 0) > 0

export function connectedView(
  t: TFunction<'tickets'>,
  {
    projectId,
    connection,
    onDisconnectSource,
    selectedKey,
    detail,
    now,
    onBack,
    onSelect,
    onOpenSession,
    onReconnect,
    onSync,
    ...listing
  }: Connected,
): TicketsView {
  const { list } = listing
  const account = isConnectionProblem(connection)
    ? connectionProblem(connection, { onReconnect, onDisconnectSource })
    : null
  // Saved Tickets stay on screen while their Account cannot be read; only writes are withheld.
  if (account && !hasSavedRows(list.data)) return { kind: 'problem', ...account }
  if (list.isPending) return loading(t('loading.tickets'))
  if (list.error && !list.isFetchNextPageError) {
    return failure(t('failure.tickets'), list.error, {
      onRetry: list.refetch,
      onReconnect,
      provider: connection.provider,
    })
  }
  const saved = savedRead(list.data)
  const failed = saved?.failure ?? null
  const recovery = { onRetry: onSync, onReconnect, provider: connection.provider }
  // With nothing saved, the failure is all there is to show; otherwise it sits above the rows.
  if (!account && failed && (saved === null || saved.total === 0))
    return failure(t('failure.tickets'), failed, recovery)
  // Nothing is saved yet and the provider has not answered, so an empty list would be a guess.
  if (saved && saved.total === 0 && !saved.complete) return loading(t('loading.tickets'))
  const sync = {
    refreshing: saved?.refreshing ?? false,
    problem:
      account ?? refreshProblem(t, { failed, query: listing.query, recovery }, connection.provider),
  }
  const detailRecovery = { ...recovery, onRetry: detail.retry }
  return {
    kind: 'tickets',
    projectId,
    selectedKey,
    detail: {
      ticket: detail.ticket,
      statuses: detail.statuses,
      reading: detail.reading,
      problem: detailProblem(t, detail, detailRecovery),
    },
    now,
    onBack,
    onSelect,
    onOpenSession,
    backlog: {
      ...listedBacklog(list.data, listing),
      provider: connection.provider,
      partial: saved !== null && !saved.complete,
      writable: account === null,
      sync,
    },
  }
}
