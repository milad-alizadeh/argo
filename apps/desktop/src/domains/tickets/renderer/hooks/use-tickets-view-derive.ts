// The view-derivation helpers `useTicketsView` composes: each reads one loading/error/ready shape
// out of its inputs, kept out of the hook file to stay under the per-file line cap.
import type { UseQueryResult } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { AccountListing } from '@/domains/accounts/renderer'
import type { ProjectSummary } from '@/domains/projects/renderer'
import type {
  ConnectionSummary,
  TicketPriority,
  TicketStatus,
} from '@/domains/tickets/contract/contract'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import type { ConnectSourceFormProps } from '../connection/connect-source-form'
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
  now: number
  onBack: () => void
  onSelect: (key: string) => void
  onOpenSession: (id: string) => void
  onReconnect: () => void
}

export function connectedView(
  t: TFunction<'tickets'>,
  {
    projectId,
    connection,
    onDisconnectSource,
    selectedKey,
    now,
    onBack,
    onSelect,
    onOpenSession,
    onReconnect,
    ...listing
  }: Connected,
): TicketsView {
  if (isConnectionProblem(connection)) {
    return {
      kind: 'problem',
      ...connectionProblem(connection, { onReconnect, onDisconnectSource }),
    }
  }
  const { list } = listing
  if (list.isPending) return loading(t('loading.tickets'))
  if (list.error && !list.isFetchNextPageError) {
    return failure(t('failure.tickets'), list.error, {
      onRetry: list.refetch,
      onReconnect,
      provider: connection.provider,
    })
  }
  return {
    kind: 'tickets',
    projectId,
    selectedKey,
    now,
    onBack,
    onSelect,
    onOpenSession,
    backlog: { ...listedBacklog(list.data, listing), provider: connection.provider },
  }
}
