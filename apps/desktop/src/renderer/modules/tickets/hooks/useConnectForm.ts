// The connect form's own state: the Account picked, the repositories it can see and the connect
// action, resolved before the form draws.
import type { UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import type { AccountSummary } from '@/core/accounts/contract'
import type { ContractFailure } from '../../../lib/query-client'
import { openAccountsDialog } from '../../accounts/state/useAccountsDialog'
import type { ConnectRepositoryFormProps } from '../components/ConnectRepositoryForm'
import type { RepositoryDiscovery } from '../components/RepositoryField'
import { useConnectRepository, useRepositories } from './useTickets'

export type ConnectForm = Omit<ConnectRepositoryFormProps, 'projectName' | 'accounts'>

// The Account the person picked while it stays connected, else the first connected one.
function chosenAccount(accounts: readonly AccountSummary[] | undefined, picked: string | null) {
  const connected = accounts?.filter((account) => account.state === 'connected') ?? []
  return (connected.find((account) => account.id === picked) ?? connected[0])?.id ?? null
}

function discovery(repositories: UseQueryResult<string[], ContractFailure>): RepositoryDiscovery {
  if (repositories.isPending) return { state: 'loading' }
  if (repositories.error) {
    const onRetry = () => void repositories.refetch()
    return { state: 'failed', message: repositories.error.message, onRetry }
  }
  return { state: 'listed', scopes: repositories.data }
}

// Nothing is read from GitHub while `open` is false, which is while the Project has a Connection.
export function useConnectForm(
  projectId: string | null,
  accounts: readonly AccountSummary[] | undefined,
  open: boolean,
): ConnectForm {
  const [picked, setPicked] = useState<string | null>(null)
  const accountId = chosenAccount(accounts, picked)
  const repositories = useRepositories(projectId, open ? accountId : null)
  const connectRepository = useConnectRepository()
  return {
    accountId,
    repositories: discovery(repositories),
    onSelectAccount: setPicked,
    pending: connectRepository.isPending,
    error: connectRepository.variables?.projectId === projectId ? connectRepository.error : null,
    onConnectRepository: (target) => {
      if (projectId) connectRepository.mutate({ projectId, ...target })
    },
    onConnectAccount: openAccountsDialog,
  }
}
