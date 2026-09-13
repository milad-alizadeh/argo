// The Tickets screen's one reading of state: the selected Project, its Connection, the Accounts and
// the Tickets, resolved into the single view the screen draws.
import type { UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query'
import type { Provider } from '@/core/accounts/contract'
import type { ProjectSummary } from '@/core/projects/messages'
import type { ConnectionSummary } from '@/core/tickets/contract'
import type { ContractFailure } from '../../../lib/query-client'
import { type AccountListing, useAccounts } from '../../accounts/hooks/useAccounts'
import { openAccountsDialog } from '../../accounts/state/useAccountsDialog'
import { useSelectedProject } from '../../projects/hooks/useSelectedProject'
import type { ConnectSourceFormProps } from '../components/ConnectSourceForm'
import type { TicketDeckProps } from '../components/TicketDeck'
import { type Backlog, uniqueTickets } from '../lib/backlog'
import {
  connectionProblem,
  failureProblem,
  isConnectionProblem,
  type TicketProblemProps,
} from '../lib/problems'
import { useSettledQuery } from '../state/useTicketSearch'
import { type ConnectForm, useConnectForm } from './useConnectForm'
import { type TicketPages, useConnection, useDisconnectSource, useTicketList } from './useTickets'

// Everything the Tickets screen can show, resolved here before anything draws.
export type TicketsView =
  | { kind: 'no-project' }
  | { kind: 'loading'; label: string }
  | ({ kind: 'problem' } & TicketProblemProps)
  | ({ kind: 'unconnected'; projectId: string } & ConnectSourceFormProps)
  | ({ kind: 'tickets'; projectId: string } & TicketDeckProps)

export type TicketsScreenProps = { view: TicketsView }

const loading = (label: string): TicketsView => ({ kind: 'loading', label })

type Retry = { onRetry: () => unknown; provider: Provider | null }

const failure = (
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

function unconnectedView(
  project: ProjectSummary,
  accounts: UseQueryResult<AccountListing, ContractFailure>,
  form: ConnectForm,
): TicketsView {
  if (accounts.isPending) return loading('Reading Accounts')
  if (accounts.error) {
    return failure('Unable to read Accounts', accounts.error, {
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

type TicketListing = UseInfiniteQueryResult<TicketPages, ContractFailure>

type Connected = {
  projectId: string
  connection: ConnectionSummary
  list: TicketListing
  query: string
  onDisconnectSource: () => void
}

function backlog(
  pages: TicketPages,
  list: TicketListing,
  query: string,
): Omit<Backlog, 'provider'> {
  return {
    tickets: uniqueTickets(pages.pages),
    query,
    total: pages.pages[0]?.total ?? null,
    hasMore: list.hasNextPage,
    loadingMore: list.isFetchingNextPage,
    loadMoreError: list.isFetchNextPageError ? list.error.message : null,
    searching: list.isPlaceholderData,
    onLoadMore: () => {
      if (!list.isFetching) void list.fetchNextPage()
    },
    onRetryLoadMore: () => {
      if (!list.isFetching) void list.fetchNextPage()
    },
  }
}

function connectedView({
  projectId,
  connection,
  list,
  query,
  onDisconnectSource,
}: Connected): TicketsView {
  if (isConnectionProblem(connection)) {
    return {
      kind: 'problem',
      ...connectionProblem(connection, { onReconnect: openAccountsDialog, onDisconnectSource }),
    }
  }
  if (list.isPending) return loading('Reading Tickets')
  if (list.error && !list.isFetchNextPageError) {
    return failure('Unable to read Tickets', list.error, {
      onRetry: list.refetch,
      provider: connection.provider,
    })
  }
  return {
    kind: 'tickets',
    projectId,
    backlog: { ...backlog(list.data, list, query), provider: connection.provider },
  }
}

export function useTicketsView(): TicketsScreenProps {
  const project = useSelectedProject()
  const projectId = project?.id ?? null
  const accounts = useAccounts()
  const connection = useConnection(projectId)
  const query = useSettledQuery()
  const list = useTicketList(projectId, connection.data ?? null, query)
  const form = useConnectForm(projectId, accounts.data?.accounts, connection.data === null)
  const disconnectSource = useDisconnectSource()

  function view(): TicketsView {
    if (!project) return { kind: 'no-project' }
    if (connection.isPending) return loading('Reading the connected Ticket source')
    if (connection.error) {
      return failure('Unable to read the connected Ticket source', connection.error, {
        onRetry: connection.refetch,
        provider: null,
      })
    }
    if (connection.data === null) return unconnectedView(project, accounts, form)
    const onDisconnectSource = () => disconnectSource.mutate({ projectId: project.id })
    return connectedView({
      projectId: project.id,
      connection: connection.data,
      list,
      query,
      onDisconnectSource,
    })
  }

  return { view: view() }
}
