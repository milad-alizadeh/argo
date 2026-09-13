// The Tickets screen's one reading of state: the selected Project, its Binding, the Accounts and
// the Tickets, resolved into the single view the screen draws.
import type { UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query'
import type { ProjectSummary } from '@/core/projects/messages'
import type { BindingSummary } from '@/core/tickets/contract'
import type { ContractFailure } from '../../../lib/query-client'
import { type AccountListing, useAccounts } from '../../accounts/hooks/useAccounts'
import { openAccountsDialog } from '../../accounts/state/useAccountsDialog'
import { useSelectedProject } from '../../projects/state/ProjectsContext'
import type { BindFormProps } from '../components/BindForm'
import type { TicketDeckProps } from '../components/TicketDeck'
import { type Backlog, uniqueTickets } from '../lib/backlog'
import {
  bindingProblem,
  failureProblem,
  isBindingProblem,
  type TicketProblemProps,
} from '../lib/problems'
import { useSettledQuery } from '../state/useTicketSearch'
import { type TicketPages, useBind, useBinding, useTicketList, useUnbind } from './useTickets'

// Everything the Tickets screen can show, resolved here before anything draws.
export type TicketsView =
  | { kind: 'no-project' }
  | { kind: 'loading'; label: string }
  | ({ kind: 'problem' } & TicketProblemProps)
  | ({ kind: 'unbound'; projectId: string } & BindFormProps)
  | ({ kind: 'tickets'; projectId: string } & TicketDeckProps)

export type TicketsScreenProps = { view: TicketsView }

const loading = (label: string): TicketsView => ({ kind: 'loading', label })

const failure = (title: string, error: ContractFailure, onRetry: () => void): TicketsView => ({
  kind: 'problem',
  ...failureProblem(title, error, {
    onRetry: () => void onRetry(),
    onReconnect: openAccountsDialog,
  }),
})

type Bind = ReturnType<typeof useBind>

function unboundView(
  project: ProjectSummary,
  accounts: UseQueryResult<AccountListing, ContractFailure>,
  bind: Bind,
): TicketsView {
  if (accounts.isPending) return loading('Reading GitHub Accounts')
  if (accounts.error) return failure('Unable to read Accounts', accounts.error, accounts.refetch)
  return {
    kind: 'unbound',
    projectId: project.id,
    projectName: project.name,
    accounts: accounts.data.accounts,
    pending: bind.isPending,
    error: bind.variables?.projectId === project.id ? bind.error : null,
    onBind: (target) => bind.mutate({ projectId: project.id, ...target }),
    onConnect: openAccountsDialog,
  }
}

type TicketListing = UseInfiniteQueryResult<TicketPages, ContractFailure>

type Bound = {
  projectId: string
  binding: BindingSummary
  list: TicketListing
  query: string
  onUnbind: () => void
}

function backlog(pages: TicketPages, list: TicketListing, query: string): Omit<Backlog, 'scope'> {
  return {
    tickets: uniqueTickets(pages.pages),
    query,
    total: pages.pages[0]?.total ?? null,
    hasMore: list.hasNextPage,
    loadingMore: list.isFetchingNextPage,
    searching: list.isPlaceholderData,
    onLoadMore: () => {
      if (!list.isFetching) void list.fetchNextPage()
    },
  }
}

function boundView({ projectId, binding, list, query, onUnbind }: Bound): TicketsView {
  if (isBindingProblem(binding)) {
    return {
      kind: 'problem',
      ...bindingProblem(binding, { onReconnect: openAccountsDialog, onUnbind }),
    }
  }
  if (list.isPending) return loading('Reading Tickets')
  if (list.error) return failure('Unable to read Tickets', list.error, list.refetch)
  return {
    kind: 'tickets',
    projectId,
    backlog: { ...backlog(list.data, list, query), scope: binding.scope },
  }
}

export function useTicketsView(): TicketsScreenProps {
  const project = useSelectedProject()
  const projectId = project?.id ?? null
  const accounts = useAccounts()
  const binding = useBinding(projectId)
  const query = useSettledQuery()
  const list = useTicketList(projectId, binding.data ?? null, query)
  const bind = useBind()
  const unbind = useUnbind()

  function view(): TicketsView {
    if (!project) return { kind: 'no-project' }
    if (binding.isPending) return loading('Reading the connected repository')
    if (binding.error)
      return failure('Unable to read the connected repository', binding.error, binding.refetch)
    if (binding.data === null) return unboundView(project, accounts, bind)
    const onUnbind = () => unbind.mutate({ projectId: project.id })
    return boundView({ projectId: project.id, binding: binding.data, list, query, onUnbind })
  }

  return { view: view() }
}
