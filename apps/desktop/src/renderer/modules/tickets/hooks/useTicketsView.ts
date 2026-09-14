// The Tickets screen's one reading of state: the selected Project, its Connection, the Accounts and
// the Tickets, resolved into the single view the screen draws.
import type { UseQueryResult } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import type { Provider } from '@/core/accounts/contract'
import type { ProjectSummary } from '@/core/projects/messages'
import type { ConnectionSummary, TicketStatus } from '@/core/tickets/contract'
import type { ContractFailure } from '../../../lib/query-client'
import { type AccountListing, useAccounts } from '../../accounts/hooks/useAccounts'
import { openAccountsDialog } from '../../accounts/state/useAccountsDialog'
import { useSelectedProject } from '../../projects/hooks/useSelectedProject'
import type { ConnectSourceFormProps } from '../components/ConnectSourceForm'
import type { TicketDeckProps } from '../components/TicketDeck'
import {
  connectionProblem,
  failureProblem,
  isConnectionProblem,
  type TicketProblemProps,
} from '../lib/problems'
import { useSettledQuery } from '../state/useTicketSearch'
import { listedBacklog, type TicketListing } from './listedBacklog'
import { type ConnectForm, useConnectForm } from './useConnectForm'
import { useConnection, useDisconnectSource, useTicketList } from './useTickets'
import { useUpdateStatus } from './useUpdateStatus'

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

type Connected = {
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

function connectedView({
  projectId,
  connection,
  onDisconnectSource,
  selectedKey,
  onSelect,
  onOpenSession,
  ...listing
}: Connected): TicketsView {
  if (isConnectionProblem(connection)) {
    return {
      kind: 'problem',
      ...connectionProblem(connection, { onReconnect: openAccountsDialog, onDisconnectSource }),
    }
  }
  const { list } = listing
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
    selectedKey,
    onSelect,
    onOpenSession,
    backlog: { ...listedBacklog(list.data, listing), provider: connection.provider },
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
  const updateStatus = useUpdateStatus()
  const { ticketKey } = useParams()
  const navigate = useNavigate()

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
    const projectId = project.id
    return connectedView({
      projectId,
      connection: connection.data,
      list,
      query,
      onDisconnectSource: () => disconnectSource.mutate({ projectId }),
      onChangeStatus: (key, status) => updateStatus.mutate({ projectId, key, status }),
      selectedKey: ticketKey ?? null,
      onSelect: (key) => navigate(`/tickets/${key}`),
      onOpenSession: (id) => navigate(`/sessions/${id}`),
    })
  }

  return { view: view() }
}
