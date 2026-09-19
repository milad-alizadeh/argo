// The view-derivation helpers `useTicketsView` composes: each reads one loading/error/ready shape
// out of its inputs, kept out of the hook file to stay under the per-file line cap.
import type { UseQueryResult } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { AccountListing } from '@/domains/accounts/renderer/hooks/use-accounts'
import { openAccountsDialog } from '@/domains/accounts/renderer/state/use-accounts-dialog'
import type { ProjectSummary } from '@/domains/projects/contract/messages'
import type {
  ConnectionSummary,
  TicketPriority,
  TicketStatus,
} from '@/domains/tickets/contract/contract'
import type { ConnectSourceFormProps } from '@/domains/tickets/renderer/components/connect-source-form'
import type { TicketDeckProps } from '@/domains/tickets/renderer/components/ticket-deck'
import { listedBacklog, type TicketListing } from '@/domains/tickets/renderer/hooks/listed-backlog'
import type { ConnectForm } from '@/domains/tickets/renderer/hooks/use-connect-form'
import {
  connectionProblem,
  failureProblem,
  isConnectionProblem,
  type TicketProblemProps,
} from '@/domains/tickets/renderer/lib/problems'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'

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
  return {
    kind: 'tickets',
    projectId,
    selectedKey,
    onSelect,
    onOpenSession,
    backlog: { ...listedBacklog(list.data, listing), provider: connection.provider },
  }
}
