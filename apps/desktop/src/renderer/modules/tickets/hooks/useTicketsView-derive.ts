// The view-derivation helpers `useTicketsView` composes: each reads one loading/error/ready shape
// out of its inputs, kept out of the hook file to stay under the per-file line cap.
import type { UseQueryResult } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import type { Provider } from '@/core/accounts/contract'
import type { ProjectSummary } from '@/core/projects/messages'
import type { ConnectionSummary, TicketStatus } from '@/core/tickets/contract'
import type { ContractFailure } from '../../../lib/query-client'
import type { AccountListing } from '../../accounts/hooks/useAccounts'
import { openAccountsDialog } from '../../accounts/state/useAccountsDialog'
import type { ConnectSourceFormProps } from '../components/ConnectSourceForm'
import type { TicketDeckProps } from '../components/TicketDeck'
import {
  connectionProblem,
  failureProblem,
  isConnectionProblem,
  type TicketProblemProps,
} from '../lib/problems'
import { listedBacklog, type TicketListing } from './listedBacklog'
import type { ConnectForm } from './useConnectForm'

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
