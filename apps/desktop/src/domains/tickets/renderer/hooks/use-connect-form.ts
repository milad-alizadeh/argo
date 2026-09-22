// The connect form's own state: the Account picked, the sources it can see and the connect
// action, resolved before the form draws.
import type { UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import type { AccountSummary } from '@/domains/accounts/contract/contract'
import { openAccountsDialog } from '@/domains/accounts/renderer'
import type { TicketScope } from '@/domains/tickets/contract/contract'
import type { ConnectSourceFormProps } from '@/domains/tickets/renderer/connection/connect-source-form'
import type { SourceDiscovery } from '@/domains/tickets/renderer/connection/source-field'
import { useContractText } from '@/platform/renderer/i18n/contract-text'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import { useConnectSource, useSources } from './use-tickets'

export type ConnectForm = Omit<ConnectSourceFormProps, 'projectName' | 'accounts'>

// The Account the person picked while it stays connected, else the first connected one.
function chosenAccount(accounts: readonly AccountSummary[] | undefined, picked: string | null) {
  const connected = accounts?.filter((account) => account.state === 'connected') ?? []
  return (connected.find((account) => account.id === picked) ?? connected[0])?.id ?? null
}

function discovery(
  sources: UseQueryResult<TicketScope[], ContractFailure>,
  contractText: (failure: ContractFailure) => string,
): SourceDiscovery {
  if (sources.isPending) return { state: 'loading' }
  if (sources.error) {
    const onRetry = () => void sources.refetch()
    return { state: 'failed', message: contractText(sources.error), onRetry }
  }
  return { state: 'listed', scopes: sources.data }
}

// Nothing is read from a provider while `open` is false, which is while the Project has a Connection.
export function useConnectForm(
  projectId: string | null,
  accounts: readonly AccountSummary[] | undefined,
  open: boolean,
): ConnectForm {
  const [picked, setPicked] = useState<string | null>(null)
  const accountId = chosenAccount(accounts, picked)
  const sources = useSources(projectId, open ? accountId : null)
  const connectSource = useConnectSource()
  const contractText = useContractText()
  return {
    accountId,
    sources: discovery(sources, contractText),
    onSelectAccount: setPicked,
    pending: connectSource.isPending,
    error: connectSource.variables?.projectId === projectId ? connectSource.error : null,
    onConnectSource: (target) => {
      if (projectId) connectSource.mutate({ projectId, ...target })
    },
    onConnectAccount: openAccountsDialog,
  }
}
