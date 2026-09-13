// The Tickets screen's one reading of state: the selected Project, its Binding, the Accounts and
// the Tickets, resolved into the single view the screen draws.
import type { UseQueryResult } from '@tanstack/react-query'
import type { ProjectSummary } from '@/core/projects/messages'
import type { BindingSummary, Ticket } from '@/core/tickets/contract'
import type { ContractFailure } from '../../../lib/query-client'
import type { SignInNoticeProps } from '../../accounts/components/SignInNotice'
import {
  type AccountListing,
  useAccounts,
  useDismissNotice,
} from '../../accounts/hooks/useAccounts'
import { openAccountsDialog } from '../../accounts/state/useAccountsDialog'
import { useSelectedProject } from '../../projects/state/ProjectsContext'
import type { BindFormProps } from '../components/BindForm'
import type { BindingProblemProps } from '../components/BindingProblem'
import { isBindingProblem } from '../components/BindingProblem'
import type { TicketDeckProps } from '../components/TicketDeck'
import type { TicketFailureProps } from '../components/TicketFailure'
import { useBind, useBinding, useTicketList, useUnbind } from './useTickets'

// Everything the Tickets screen can show, resolved here before anything draws.
export type TicketsView =
  | { kind: 'no-project' }
  | { kind: 'loading'; label: string }
  | ({ kind: 'failure' } & TicketFailureProps)
  | ({ kind: 'unbound'; projectId: string } & BindFormProps)
  | ({ kind: 'binding-problem' } & BindingProblemProps)
  | ({ kind: 'tickets'; projectId: string } & TicketDeckProps)

export type TicketsScreenProps = { view: TicketsView; notice: SignInNoticeProps | null }

const loading = (label: string): TicketsView => ({ kind: 'loading', label })

const failure = (title: string, error: ContractFailure, onRetry: () => void): TicketsView => ({
  kind: 'failure',
  title,
  error,
  onRetry: () => void onRetry(),
  onReconnect: openAccountsDialog,
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

type Bound = {
  projectId: string
  binding: BindingSummary
  list: UseQueryResult<Ticket[], ContractFailure>
  onUnbind: () => void
}

function boundView({ projectId, binding, list, onUnbind }: Bound): TicketsView {
  if (isBindingProblem(binding)) {
    return { kind: 'binding-problem', binding, onReconnect: openAccountsDialog, onUnbind }
  }
  if (list.isPending) return loading('Reading Tickets')
  if (list.error) return failure('Unable to read Tickets', list.error, list.refetch)
  const { scope } = binding
  return { kind: 'tickets', projectId, scope, tickets: list.data, onUnbind }
}

export function useTicketsView(): TicketsScreenProps {
  const project = useSelectedProject()
  const projectId = project?.id ?? null
  const accounts = useAccounts()
  const dismiss = useDismissNotice()
  const binding = useBinding(projectId)
  const list = useTicketList(projectId, binding.data ?? null)
  const bind = useBind()
  const unbind = useUnbind()
  const notice = accounts.data?.notice
    ? { onConnect: openAccountsDialog, onDismiss: () => dismiss.mutate(undefined) }
    : null

  function view(): TicketsView {
    if (!project) return { kind: 'no-project' }
    if (binding.isPending) return loading('Reading the Binding')
    if (binding.error) return failure('Unable to read the Binding', binding.error, binding.refetch)
    if (binding.data === null) return unboundView(project, accounts, bind)
    const onUnbind = () => unbind.mutate({ projectId: project.id })
    return boundView({ projectId: project.id, binding: binding.data, list, onUnbind })
  }

  return { notice, view: view() }
}
