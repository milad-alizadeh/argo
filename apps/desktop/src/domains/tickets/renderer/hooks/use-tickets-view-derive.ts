// The view-derivation helpers `useTicketsView` composes: each reads one loading/error/ready shape
// out of its inputs, kept out of the hook file to stay under the per-file line cap.
import type { UseQueryResult } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { AccountListing } from '@/domains/accounts/renderer'
import { openAccountsDialog } from '@/domains/accounts/renderer'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import type {
  ConnectionSummary,
  Ticket,
  TicketPriority,
  TicketStatus,
} from '@/domains/tickets/contract/contract'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import type { ConnectSourceFormProps } from '../connection/connect-source-form'
import { ticketSelectionState } from '../detail/selected-ticket'
import type { TicketDeckProps } from '../detail/ticket-deck'
import {
  connectionProblem,
  failureProblem,
  isConnectionProblem,
  type TicketProblemProps,
} from '../lib/problems'
import { listedBacklog, type TicketListing } from './listed-backlog'
import type { ConnectForm } from './use-connect-form'

// Everything the Tickets screen can show, resolved here before anything draws.
export type TicketsView =
  | { kind: 'no-project' }
  | { kind: 'loading'; label: string }
  | ({ kind: 'problem' } & TicketProblemProps)
  | ({ kind: 'unconnected'; projectId: string } & ConnectSourceFormProps)
  | ({ kind: 'tickets'; projectId: string } & TicketDeckProps)

export const loading = (label: string): TicketsView => ({ kind: 'loading', label })

type Retry = { onRetry: () => unknown; provider: Provider | null }

export const failure = (
  title: string,
  error: ContractFailure,
  { onRetry, provider }: Retry,
): TicketsView => ({
  kind: 'problem',
  ...failureProblem(title, error, {
    onRetry: () => void onRetry(),
    onReconnect: openAccountsDialog,
    provider,
  }),
})

export type Unconnected = {
  project: ProjectSummary
  accounts: UseQueryResult<AccountListing, ContractFailure>
  form: ConnectForm
}

export function unconnectedView(
  t: TFunction<'tickets'>,
  { project, accounts, form }: Unconnected,
): TicketsView {
  if (accounts.isPending) return loading(t('loading.accounts'))
  if (accounts.error) {
    return failure(t('failure.accounts'), accounts.error, {
      onRetry: accounts.refetch,
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
  resolvedTicket: Ticket | null
  resolvedTicketError: ContractFailure | null
  resolvedTicketPending: boolean
  onRetryResolvedTicket: () => unknown
  resolvedStatuses: TicketStatus[]
  onSelect: (key: string) => void
  onOpenSession: (id: string) => void
}

export function connectedView(
  t: TFunction<'tickets'>,
  {
    projectId,
    connection,
    onDisconnectSource,
    selectedKey,
    resolvedTicket,
    resolvedTicketError,
    resolvedTicketPending,
    onRetryResolvedTicket,
    resolvedStatuses,
    onSelect,
    onOpenSession,
    ...listing
  }: Connected,
): TicketsView {
  if (isConnectionProblem(connection)) {
    return {
      kind: 'problem',
      ...connectionProblem(connection, { onReconnect: openAccountsDialog, onDisconnectSource }),
    }
  }
  const { list } = listing
  if (list.isPending) return loading(t('loading.tickets'))
  if (list.error && !list.isFetchNextPageError) {
    return failure(t('failure.tickets'), list.error, {
      onRetry: list.refetch,
      provider: connection.provider,
    })
  }
  const selection = ticketSelectionState({
    tickets: list.data?.pages.flatMap((page) => page.tickets) ?? [],
    selectedKey,
    resolvedTicket,
    pending: resolvedTicketPending,
    error: resolvedTicketError,
  })
  if (selection.kind === 'failure')
    return failure(t('failure.tickets'), selection.error, {
      onRetry: onRetryResolvedTicket,
      provider: connection.provider,
    })
  if (selection.kind === 'loading') return loading(t('loading.tickets'))
  return {
    kind: 'tickets',
    projectId,
    selectedKey,
    resolvedTicket,
    resolvedStatuses,
    onSelect,
    onOpenSession,
    backlog: { ...listedBacklog(list.data, listing), provider: connection.provider },
  }
}
